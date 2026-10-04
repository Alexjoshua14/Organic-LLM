"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  ReactNode,
  useRef,
  useState,
} from "react";
import { Chat } from "@ai-sdk/react";
import useSWRInfinite from "swr/infinite";
import { DefaultChatTransport, UIMessage } from "ai";

import { ThreadLink } from "@/types";
import {
  isFirstSidebarPageKey,
  mergeSidebarPages,
  patchSidebarPages,
  removeFromSidebarPages,
  sidebarPageKey,
  toThreadLink,
  type SidebarThreadPatch,
  type SidebarThreadScope,
  type SidebarThreadsPage,
} from "@/lib/chat/sidebar-threads";
import { getSettings } from "@/lib/user-settings";
import { PERF_PHASES } from "@/lib/perf/journeys";
import { mark } from "@/lib/perf/trace-store";
import {
  bindTitleRegenFinish,
  completeTitleRegen,
  getTitleRegenSession,
  hasTitleRegen,
  publishTitleRegen,
  startTitleRegen,
} from "@/lib/chat/title-regen-store";

/** Fetcher for one sidebar page. Errors carry the HTTP status for callers. */
async function sidebarPageFetcher(url: string): Promise<SidebarThreadsPage> {
  const res = await fetch(url);

  if (!res.ok) {
    const err = new Error(res.status === 401 ? "Unauthorized" : "Failed to fetch chats");

    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return res.json();
}

/** Coalescence mode lists every feature; it is the sidebar scope, so it is part of the key. */
function useSidebarScope(): SidebarThreadScope {
  // Read on first client render so coalescence mode does not fetch `main` first. The
  // scope only shapes the SWR key, and nothing is fetched during SSR.
  const [scope, setScope] = useState<SidebarThreadScope>(() =>
    typeof window !== "undefined" && getSettings().coalescenceMode ? "all" : "main"
  );

  useEffect(() => {
    const update = () => setScope(getSettings().coalescenceMode ? "all" : "main");

    update();
    window.addEventListener("organic-llm-settings", update);
    window.addEventListener("storage", update);

    return () => {
      window.removeEventListener("organic-llm-settings", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return scope;
}

export interface ChatContextValue {
  chat: Chat<UIMessage>;
  clearChat: () => void;
  setChatId: (chatId: string) => void;
  chatId: string;
  /**
   * Loaded sidebar threads (pinned first, then newest unpinned), already filtered to the
   * current scope. Owned here so it can start fetching on app mount, independent of
   * sidebar visibility. Older threads arrive page by page via `loadMoreSidebarChats`.
   */
  sidebarChats: ThreadLink[];
  sidebarPinnedChats: ThreadLink[];
  sidebarUnpinnedChats: ThreadLink[];
  isSidebarChatsLoading: boolean;
  isSidebarChatsLoadingMore: boolean;
  hasMoreSidebarChats: boolean;
  sidebarChatsError: Error | null;
  loadMoreSidebarChats: () => void;
  /**
   * Revalidate after a change the client cannot describe (create, new activity).
   * Refetches the first page only, where new and bumped threads land. Pass
   * `{ allPages: true }` after changing threads that may sit in older pages.
   */
  refreshSidebarChats: (options?: { allPages?: boolean }) => void;
  /** Apply a change the server already confirmed (rename, pin) without refetching. */
  updateSidebarChat: (id: string, patch: SidebarThreadPatch) => void;
  /** Drop a thread the server already deleted, without refetching. */
  removeSidebarChat: (id: string) => void;
  /**
   * Kept for existing callers. Live checks use `isTitleRegenerating` or
   * `useTitleRegenSession`, which do not re-render the chat tree.
   */
  titleRegenThreadIds: ReadonlySet<string>;
  /** True while this thread's title regeneration is in flight or finishing its burn. */
  isTitleRegenerating: (threadId: string) => boolean;
  /**
   * Title string the regen indication should render. The base title while the request
   * is in flight, then the resolved title so the burn can run as soon as it arrives.
   */
  getTitleRegenBurnText: (threadId: string, fallbackTitle: string) => string;
  /** Mark regeneration started — disables regenerate for this thread until finished. */
  beginTitleRegen: (threadId: string, baseTitle: string) => void;
  /**
   * API returned a title. The indication burns from the base title into this one,
   * then `finishTitleRegen` clears the lock after that burn settles.
   */
  resolveTitleRegen: (threadId: string, title: string) => void;
  /** True once resolve has a title ready to burn in. */
  isTitleRegenReadyToCommit: (threadId: string) => boolean;
  /** Applies the resolved title to the sidebar cache and clears regen lock. */
  finishTitleRegen: (threadId: string) => void;
}

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function createChat() {
  return new Chat<UIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
}

/**
 * SWR's own focus/reconnect revalidation is off: with `revalidateFirstPage` it also
 * refetches page one before every older page, doubling the cost of each scroll. The
 * provider revalidates the first page itself on focus and reconnect instead.
 */
const sidebarChatsSwrOptions = {
  revalidateOnReconnect: false,
  revalidateOnFocus: false,
  dedupingInterval: 10_000,
  revalidateFirstPage: false,
  revalidateAll: false,
} as const;

const EMPTY_TITLE_REGEN_IDS: ReadonlySet<string> = new Set();

/** Focus refetches the first page at most this often, to catch other tabs and devices. */
const SIDEBAR_FOCUS_REVALIDATE_MS = 60_000;

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(() => createChat());
  const [chatId, setChatId] = useState<string>("");
  const sidebarLoadedMarkedRef = useRef(false);

  const scope = useSidebarScope();

  const {
    data: sidebarPages,
    error: sidebarChatsError,
    isLoading: isSidebarChatsLoading,
    size: sidebarPageCount,
    setSize: setSidebarPageCount,
    mutate: mutateSidebarPages,
  } = useSWRInfinite<SidebarThreadsPage>(
    (index, previous: SidebarThreadsPage | null) => sidebarPageKey(scope, index, previous),
    sidebarPageFetcher,
    {
      ...sidebarChatsSwrOptions,
      onSuccess: () => {
        if (sidebarLoadedMarkedRef.current) return;
        sidebarLoadedMarkedRef.current = true;
        mark(PERF_PHASES.sidebarChatsLoaded);
      },
    }
  );

  const { sidebarPinnedChats, sidebarUnpinnedChats, sidebarChats } = useMemo(() => {
    const { pinned, unpinned } = mergeSidebarPages(sidebarPages);
    const pinnedLinks = pinned.map(toThreadLink);
    const unpinnedLinks = unpinned.map(toThreadLink);

    return {
      sidebarPinnedChats: pinnedLinks,
      sidebarUnpinnedChats: unpinnedLinks,
      sidebarChats: [...pinnedLinks, ...unpinnedLinks],
    };
  }, [sidebarPages]);

  const lastPage = sidebarPages?.at(-1);
  const hasMoreSidebarChats = Boolean(lastPage?.nextCursor);
  const isSidebarChatsLoadingMore =
    !sidebarChatsError &&
    sidebarPages !== undefined &&
    sidebarPages[sidebarPageCount - 1] === undefined;

  const loadMoreSidebarChats = useCallback(() => {
    if (!hasMoreSidebarChats || isSidebarChatsLoadingMore) return;
    void setSidebarPageCount((count) => count + 1);
  }, [hasMoreSidebarChats, isSidebarChatsLoadingMore, setSidebarPageCount]);

  const refreshSidebarChats = useCallback(
    (options?: { allPages?: boolean }) => {
      if (options?.allPages) {
        void mutateSidebarPages();

        return;
      }
      // A page whose cursor moved has no cache yet, so it loads too.
      void mutateSidebarPages(undefined, {
        revalidate: (page, key) => page === undefined || isFirstSidebarPageKey(key),
      });
    },
    [mutateSidebarPages]
  );

  const lastFocusRefreshRef = useRef(Date.now());

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastFocusRefreshRef.current < SIDEBAR_FOCUS_REVALIDATE_MS) return;
      lastFocusRefreshRef.current = Date.now();
      refreshSidebarChats();
    };
    const onOnline = () => refreshSidebarChats();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [refreshSidebarChats]);

  const updateSidebarChat = useCallback(
    (id: string, patch: SidebarThreadPatch) => {
      void mutateSidebarPages((pages) => patchSidebarPages(pages, id, patch), {
        revalidate: false,
      });
    },
    [mutateSidebarPages]
  );

  const removeSidebarChat = useCallback(
    (id: string) => {
      void mutateSidebarPages((pages) => removeFromSidebarPages(pages, id), {
        revalidate: false,
      });
    },
    [mutateSidebarPages]
  );

  useEffect(() => {
    bindTitleRegenFinish((threadId, nextTitle) => {
      if (!nextTitle) {
        refreshSidebarChats();

        return;
      }

      updateSidebarChat(threadId, { title: nextTitle });
    });

    return () => bindTitleRegenFinish(() => {});
  }, [refreshSidebarChats, updateSidebarChat]);

  const isTitleRegenerating = useCallback((threadId: string) => hasTitleRegen(threadId), []);

  const isTitleRegenReadyToCommit = useCallback(
    (threadId: string) => getTitleRegenSession(threadId)?.nextTitle != null,
    []
  );

  const getTitleRegenBurnText = useCallback((threadId: string, fallbackTitle: string) => {
    const session = getTitleRegenSession(threadId);

    if (!session) return fallbackTitle;

    return session.nextTitle ?? session.baseTitle;
  }, []);

  const beginTitleRegen = useCallback((threadId: string, baseTitle: string) => {
    startTitleRegen(threadId, baseTitle);
  }, []);

  const resolveTitleRegen = useCallback((threadId: string, title: string) => {
    publishTitleRegen(threadId, title);
  }, []);

  const finishTitleRegen = useCallback((threadId: string) => {
    completeTitleRegen(threadId);
  }, []);

  const clearChat = () => {
    setChat(createChat());
  };

  const value = useMemo<ChatContextValue>(
    () => ({
      chat,
      clearChat,
      setChatId,
      chatId,
      sidebarChats,
      sidebarPinnedChats,
      sidebarUnpinnedChats,
      isSidebarChatsLoading,
      isSidebarChatsLoadingMore,
      hasMoreSidebarChats,
      sidebarChatsError: sidebarChatsError ?? null,
      loadMoreSidebarChats,
      refreshSidebarChats,
      titleRegenThreadIds: EMPTY_TITLE_REGEN_IDS,
      isTitleRegenerating,
      getTitleRegenBurnText,
      beginTitleRegen,
      resolveTitleRegen,
      isTitleRegenReadyToCommit,
      finishTitleRegen,
      updateSidebarChat,
      removeSidebarChat,
    }),
    [
      chat,
      chatId,
      sidebarChats,
      sidebarPinnedChats,
      sidebarUnpinnedChats,
      isSidebarChatsLoading,
      isSidebarChatsLoadingMore,
      hasMoreSidebarChats,
      sidebarChatsError,
      loadMoreSidebarChats,
      refreshSidebarChats,
      updateSidebarChat,
      removeSidebarChat,
      isTitleRegenerating,
      getTitleRegenBurnText,
      beginTitleRegen,
      resolveTitleRegen,
      isTitleRegenReadyToCommit,
      finishTitleRegen,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useSharedChatContext() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useSharedChatContext must be used within a ChatProvider");
  }

  return context;
}

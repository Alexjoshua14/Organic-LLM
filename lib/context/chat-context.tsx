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
import useSWR from "swr";
import { DefaultChatTransport, UIMessage } from "ai";

import { ThreadLink } from "@/types";
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

/**
 * SWR key for the sidebar chat list; shared so mutate(key) revalidates everywhere.
 * See docs/thread-session-architecture.md for client cache contract and when to refresh.
 */
const SIDEBAR_CHATS_KEY = "/api/chats";

/** API response shape from GET /api/chats */
interface ChatsApiResponse {
  data?: Array<{
    id: string;
    title: string | null;
    owner_id?: string;
    created_at: string;
    updated_at: string;
    pinned?: boolean;
    feature?: string | null;
    path?: string | null;
  }>;
}

/**
 * Fetcher for SWR: returns raw API response. Normalization to ThreadLink[]
 * happens in the provider so consumers receive a stable shape.
 */
async function sidebarChatsFetcher(url: string): Promise<ChatsApiResponse> {
  const res = await fetch(url);

  if (!res.ok) {
    const err = new Error(res.status === 401 ? "Unauthorized" : "Failed to fetch chats");

    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Maps API thread rows to the ThreadLink shape used by the sidebar.
 */
function normalizeToThreadLinks(rows: ChatsApiResponse["data"]): ThreadLink[] {
  if (!rows || !Array.isArray(rows)) return [];

  return rows.map((thread) => {
    const feature = thread.feature ?? undefined;
    const href =
      thread.path && String(thread.path).trim() !== "" ? String(thread.path) : `/chat/${thread.id}`;

    return {
      title: thread.title ?? "Unknown title",
      id: thread.id,
      pinned: thread.pinned ?? false,
      date: new Date(thread.updated_at).toISOString(),
      href,
      feature,
      hasNoTitle: thread.title == null || String(thread.title).trim() === "",
    };
  });
}

export interface ChatContextValue {
  chat: Chat<UIMessage>;
  clearChat: () => void;
  setChatId: (chatId: string) => void;
  chatId: string;
  /** Sidebar chat list; owned here so it can start fetching on app mount, independent of sidebar visibility. */
  sidebarChats: ThreadLink[];
  isSidebarChatsLoading: boolean;
  sidebarChatsError: Error | null;
  /** Revalidates the sidebar chat list (replaces legacy window.refreshSidebar). */
  refreshSidebarChats: () => void;
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

/** SWR options: conservative for a private sidebar list — no focus revalidation, dedupe 10s. */
const sidebarChatsSwrOptions = {
  revalidateOnReconnect: true,
  revalidateOnFocus: false,
  dedupingInterval: 10_000,
} as const;

const EMPTY_TITLE_REGEN_IDS: ReadonlySet<string> = new Set();

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(() => createChat());
  const [chatId, setChatId] = useState<string>("");
  const sidebarLoadedMarkedRef = useRef(false);

  const {
    data: chatsResponse,
    error: sidebarChatsError,
    isLoading: isSidebarChatsLoading,
    mutate: mutateSidebarChats,
  } = useSWR<ChatsApiResponse>(SIDEBAR_CHATS_KEY, sidebarChatsFetcher, {
    ...sidebarChatsSwrOptions,
    onSuccess: () => {
      if (sidebarLoadedMarkedRef.current) return;
      sidebarLoadedMarkedRef.current = true;
      mark(PERF_PHASES.sidebarChatsLoaded);
    },
  });

  const sidebarChats = useMemo(
    () => normalizeToThreadLinks(chatsResponse?.data),
    [chatsResponse?.data]
  );

  useEffect(() => {
    bindTitleRegenFinish((threadId, nextTitle) => {
      if (!nextTitle) {
        void mutateSidebarChats();

        return;
      }

      void mutateSidebarChats(
        (current) => {
          if (!current?.data) return current;

          return {
            ...current,
            data: current.data.map((row) =>
              row.id === threadId
                ? {
                    ...row,
                    title: nextTitle,
                  }
                : row
            ),
          };
        },
        { revalidate: true }
      );
    });

    return () => bindTitleRegenFinish(() => {});
  }, [mutateSidebarChats]);

  const refreshSidebarChats = useCallback(() => {
    void mutateSidebarChats();
  }, [mutateSidebarChats]);

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
      isSidebarChatsLoading,
      sidebarChatsError: sidebarChatsError ?? null,
      refreshSidebarChats,
      titleRegenThreadIds: EMPTY_TITLE_REGEN_IDS,
      isTitleRegenerating,
      getTitleRegenBurnText,
      beginTitleRegen,
      resolveTitleRegen,
      isTitleRegenReadyToCommit,
      finishTitleRegen,
    }),
    [
      chat,
      chatId,
      sidebarChats,
      isSidebarChatsLoading,
      sidebarChatsError,
      refreshSidebarChats,
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

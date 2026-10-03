"use client";

import React, {
  createContext,
  useCallback,
  useContext,
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
  /** Thread ids currently regenerating an AI title (blocks re-trigger per thread). */
  titleRegenThreadIds: ReadonlySet<string>;
  /** True while this thread's title regeneration is in flight or finishing its burn. */
  isTitleRegenerating: (threadId: string) => boolean;
  /**
   * Title string the regen indication should render. Uses the base title until the API
   * returns, then the next title (queued for the next burn-sweep boundary).
   */
  getTitleRegenBurnText: (threadId: string, fallbackTitle: string) => string;
  /** Mark regeneration started — disables regenerate for this thread until finished. */
  beginTitleRegen: (threadId: string, baseTitle: string) => void;
  /**
   * API returned a title. UI keeps looping on the base title until the next sweep
   * boundary, then burns to this title; call `finishTitleRegen` after that settles.
   */
  resolveTitleRegen: (threadId: string, title: string) => void;
  /** True once resolve has a title ready to burn in on the next loop boundary. */
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

type TitleRegenSession = {
  baseTitle: string;
  nextTitle?: string;
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(() => createChat());
  const [chatId, setChatId] = useState<string>("");
  const [titleRegenSessions, setTitleRegenSessions] = useState<Record<string, TitleRegenSession>>(
    {}
  );
  const titleRegenSessionsRef = useRef(titleRegenSessions);

  titleRegenSessionsRef.current = titleRegenSessions;
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

  const titleRegenThreadIds = useMemo(
    () => new Set(Object.keys(titleRegenSessions)),
    [titleRegenSessions]
  );

  const refreshSidebarChats = useCallback(() => {
    void mutateSidebarChats();
  }, [mutateSidebarChats]);

  const isTitleRegenerating = useCallback(
    (threadId: string) => threadId in titleRegenSessions,
    [titleRegenSessions]
  );

  const isTitleRegenReadyToCommit = useCallback(
    (threadId: string) => titleRegenSessions[threadId]?.nextTitle != null,
    [titleRegenSessions]
  );

  const getTitleRegenBurnText = useCallback(
    (threadId: string, fallbackTitle: string) => {
      const session = titleRegenSessions[threadId];

      if (!session) return fallbackTitle;

      return session.nextTitle ?? session.baseTitle;
    },
    [titleRegenSessions]
  );

  const beginTitleRegen = useCallback((threadId: string, baseTitle: string) => {
    const trimmed = baseTitle.trim() || "Untitled chat";

    setTitleRegenSessions((prev) => {
      if (prev[threadId]) return prev;

      return {
        ...prev,
        [threadId]: { baseTitle: trimmed },
      };
    });
  }, []);

  const resolveTitleRegen = useCallback((threadId: string, title: string) => {
    const trimmed = title.trim() || "Chat";

    setTitleRegenSessions((prev) => {
      const current = prev[threadId];

      if (!current) return prev;
      if (current.nextTitle === trimmed) return prev;

      return {
        ...prev,
        [threadId]: {
          ...current,
          nextTitle: trimmed,
        },
      };
    });
  }, []);

  const finishTitleRegen = useCallback(
    (threadId: string) => {
      const session = titleRegenSessionsRef.current[threadId];
      const nextTitle = session?.nextTitle;

      setTitleRegenSessions((prev) => {
        if (!(threadId in prev)) return prev;
        const rest = { ...prev };

        delete rest[threadId];

        return rest;
      });

      if (nextTitle) {
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
      } else {
        void mutateSidebarChats();
      }
    },
    [mutateSidebarChats]
  );

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
      titleRegenThreadIds,
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
      titleRegenThreadIds,
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

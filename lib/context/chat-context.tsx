"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  ReactNode,
  useState,
} from "react";
import { Chat } from "@ai-sdk/react";
import useSWR from "swr";
import { DefaultChatTransport, UIMessage } from "ai";

import { ThreadLink } from "@/types";

/** SWR key for the sidebar chat list; shared so mutate(key) revalidates everywhere. */
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
  return rows.map((thread) => ({
    title: thread.title ?? "Unknown title",
    id: thread.id,
    pinned: thread.pinned ?? false,
    date: new Date(thread.updated_at).toISOString(),
  }));
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

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(() => createChat());
  const [chatId, setChatId] = useState<string>("");

  const {
    data: chatsResponse,
    error: sidebarChatsError,
    isLoading: isSidebarChatsLoading,
    mutate: mutateSidebarChats,
  } = useSWR<ChatsApiResponse>(SIDEBAR_CHATS_KEY, sidebarChatsFetcher, sidebarChatsSwrOptions);

  const sidebarChats = useMemo(
    () => normalizeToThreadLinks(chatsResponse?.data),
    [chatsResponse?.data],
  );

  const refreshSidebarChats = useCallback(() => {
    void mutateSidebarChats();
  }, [mutateSidebarChats]);

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
    }),
    [
      chat,
      chatId,
      sidebarChats,
      isSidebarChatsLoading,
      sidebarChatsError,
      refreshSidebarChats,
    ],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useSharedChatContext() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useSharedChatContext must be used within a ChatProvider");
  }

  return context;
}

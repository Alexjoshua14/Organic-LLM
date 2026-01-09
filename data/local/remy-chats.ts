"use client";

import { UIMessage } from "ai";
import { Result } from "@/types";

const REMY_TMP_CHAT_KEY = "remy-tmp-chat";
const REMY_TMP_CHATS_KEY = "remy-tmp-chats-list";
const REMY_TMP_CHAT_EXPIRY_DAYS = 2; // 2 business days

export interface RemyTmpChat {
  id: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
  saved: boolean; // Whether it's been saved to Supabase
}

export interface RemyTmpChatMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  saved: boolean;
  preview: string; // First message preview
}

/**
 * Get the current temporary chat
 */
export async function getTmpChat(): Promise<Result<RemyTmpChat | null>> {
  if (typeof window === "undefined") {
    return { data: null, error: null };
  }

  try {
    const stored = localStorage.getItem(REMY_TMP_CHAT_KEY);
    if (!stored) {
      return { data: null, error: null };
    }

    const chat = JSON.parse(stored) as RemyTmpChat;

    // Check if expired (2 business days)
    const updatedAt = new Date(chat.updatedAt);
    const now = new Date();
    const daysSinceUpdate =
      (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate > REMY_TMP_CHAT_EXPIRY_DAYS) {
      // Clean up expired chat
      localStorage.removeItem(REMY_TMP_CHAT_KEY);
      return { data: null, error: null };
    }

    return { data: chat, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Failed to load tmp chat"),
    };
  }
}

/**
 * Save a temporary chat
 */
export async function saveTmpChat(chat: RemyTmpChat): Promise<Result<boolean>> {
  if (typeof window === "undefined") {
    return { data: false, error: null };
  }

  try {
    const updatedChat = {
      ...chat,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(REMY_TMP_CHAT_KEY, JSON.stringify(updatedChat));

    // Also update the list of tmp chats
    const chatsList = await getTmpChatsList();
    const existingIndex =
      chatsList.data?.findIndex((c) => c.id === chat.id) ?? -1;

    const metadata: RemyTmpChatMetadata = {
      id: chat.id,
      createdAt: chat.createdAt,
      updatedAt: updatedChat.updatedAt,
      saved: chat.saved,
      preview:
        chat.messages[0]?.parts
          ?.filter((p) => p.type === "text")
          .reduce((acc, p) => acc + p.text, "")
          .slice(0, 50) ?? "",
    };

    const updatedList = chatsList.data ?? [];
    if (existingIndex >= 0) {
      updatedList[existingIndex] = metadata;
    } else {
      updatedList.unshift(metadata);
    }

    // Keep only recent 50
    const limited = updatedList.slice(0, 50);
    localStorage.setItem(REMY_TMP_CHATS_KEY, JSON.stringify(limited));

    return { data: true, error: null };
  } catch (err) {
    return {
      data: false,
      error: err instanceof Error ? err : new Error("Failed to save tmp chat"),
    };
  }
}

/**
 * Get list of temporary chats metadata
 */
export async function getTmpChatsList(): Promise<
  Result<RemyTmpChatMetadata[]>
> {
  if (typeof window === "undefined") {
    return { data: [], error: null };
  }

  try {
    const stored = localStorage.getItem(REMY_TMP_CHATS_KEY);
    if (!stored) {
      return { data: [], error: null };
    }

    const chats = JSON.parse(stored) as RemyTmpChatMetadata[];

    // Filter out expired chats
    const now = new Date();
    const validChats = chats.filter((chat) => {
      const updatedAt = new Date(chat.updatedAt);
      const daysSinceUpdate =
        (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate <= REMY_TMP_CHAT_EXPIRY_DAYS;
    });

    // Update storage if we filtered any out
    if (validChats.length !== chats.length) {
      localStorage.setItem(REMY_TMP_CHATS_KEY, JSON.stringify(validChats));
    }

    return { data: validChats, error: null };
  } catch (err) {
    return {
      data: [],
      error:
        err instanceof Error ? err : new Error("Failed to load tmp chats list"),
    };
  }
}

/**
 * Delete a temporary chat
 */
export async function deleteTmpChat(id: string): Promise<Result<boolean>> {
  if (typeof window === "undefined") {
    return { data: false, error: null };
  }

  try {
    // Remove from current chat if it matches
    const current = await getTmpChat();
    if (current.data?.id === id) {
      localStorage.removeItem(REMY_TMP_CHAT_KEY);
    }

    // Remove from list
    const chatsList = await getTmpChatsList();
    const updated = (chatsList.data ?? []).filter((c) => c.id !== id);
    localStorage.setItem(REMY_TMP_CHATS_KEY, JSON.stringify(updated));

    return { data: true, error: null };
  } catch (err) {
    return {
      data: false,
      error:
        err instanceof Error ? err : new Error("Failed to delete tmp chat"),
    };
  }
}

/**
 * Clean up expired temporary chats
 */
export async function cleanupExpiredTmpChats(): Promise<Result<number>> {
  if (typeof window === "undefined") {
    return { data: 0, error: null };
  }

  try {
    const chatsList = await getTmpChatsList();
    const now = new Date();
    let cleaned = 0;

    for (const chat of chatsList.data ?? []) {
      const updatedAt = new Date(chat.updatedAt);
      const daysSinceUpdate =
        (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate > REMY_TMP_CHAT_EXPIRY_DAYS) {
        await deleteTmpChat(chat.id);
        cleaned++;
      }
    }

    return { data: cleaned, error: null };
  } catch (err) {
    return {
      data: 0,
      error:
        err instanceof Error ? err : new Error("Failed to cleanup tmp chats"),
    };
  }
}

"use client";

import { usePathname } from "next/navigation";

/**
 * Gets the currently open chat ID based on the pathname.
 * Returns the chat ID if on a chat page (/chat/[id]), otherwise returns null.
 */
export function useChatId(): string | null {
  const pathname = usePathname();
  // Match pattern: /chat/[id]
  const match = pathname.match(/^\/chat\/([^/]+)$/);
  const chatId = match ? match[1] : null;

  // Optionally, you can uncomment the next line for debugging:
  // console.log("THREAD OPENED: ", chatId);
  return chatId;
}

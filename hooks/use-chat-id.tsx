"use client";

import { usePathname } from "next/navigation";

/**
 * Gets the currently open thread id from the pathname for sidebar active state.
 * Matches main chat (`/chat/[id]`) and feature routes that use the thread id as the slug
 * (e.g. Arcadia `/sandbox/arcadia/[id]`).
 */
export function useChatId(): string | null {
  const pathname = usePathname();

  const main = pathname.match(/^\/chat\/([^/]+)$/);

  if (main) return main[1];

  const arcadia = pathname.match(/^\/sandbox\/arcadia\/([^/]+)$/);

  if (arcadia) return arcadia[1];

  return null;
}

"use client";

import { copyTextToClipboard } from "./copy";
import { parseThreadPointer } from "@/lib/chat/thread-reference";

/** Native copy starts immediately in the click gesture; cloud save runs independently. */
export async function copyThreadToClipboard(
  threadId: string
): Promise<{ copied: boolean; saved: boolean }> {
  const id = parseThreadPointer(threadId);
  if (!id) return { copied: false, saved: false };
  const nativeCopy = copyTextToClipboard(id);
  const save = fetch("/api/thread-clipboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId: id }),
    signal: AbortSignal.timeout(5_000),
  })
    .then((response) => response.ok)
    .catch(() => false);
  const [copied, saved] = await Promise.all([nativeCopy, save]);
  return { copied, saved };
}

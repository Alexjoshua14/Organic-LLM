"use client";

import { useRouter } from "next/navigation";

import Page from "@/components/layout/page";

/**
 * Shown when thread load fails (not found, network, or decryption error).
 * See docs/thread-session-architecture.md for restore and failure behavior.
 */
export function ChatLoadError() {
  const router = useRouter();

  return (
    <Page>
      <div className="sm:max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl w-full h-full flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-muted-foreground">This thread couldn&apos;t be loaded.</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      </div>
    </Page>
  );
}

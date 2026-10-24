import type { CSSProperties } from "react";

import Page from "@/components/layout/page";
import { PerfMark } from "@/components/perf/perf-mark";
import {
  CHAT_PAGE_LOADING_BREATHE_S,
  CHAT_PAGE_LOADING_ENTER_S,
  CHAT_PAGE_LOADING_EXIT_S,
} from "@/lib/chat/chat-page-loading-timing";
import { PERF_PHASES } from "@/lib/perf/journeys";
import { cn } from "@/lib/utils";

import "@/styles/ChatPageLoading.css";

type ChatPageLoadingProps = {
  /** When false, skip the to-chat perf mark (e.g. the /chat/loading demo route). */
  markPerf?: boolean;
  className?: string;
};

/**
 * Immersive chat-route loading: same Page chrome as the thread, one quiet presence.
 * CSS-only motion; SSR-safe (no client mount gate).
 */
export function ChatPageLoading({ markPerf = true, className }: ChatPageLoadingProps) {
  const style = {
    ["--cpl-enter-s" as string]: `${CHAT_PAGE_LOADING_ENTER_S}s`,
    ["--cpl-breathe-s" as string]: `${CHAT_PAGE_LOADING_BREATHE_S}s`,
    ["--cpl-exit-s" as string]: `${CHAT_PAGE_LOADING_EXIT_S}s`,
  } as CSSProperties;

  return (
    <Page>
      {markPerf ? <PerfMark name={PERF_PHASES.chatLoadingShown} /> : null}
      <div
        aria-busy="true"
        aria-live="polite"
        className={cn("chat-page-loading", className)}
        role="status"
        style={style}
      >
        <span className="sr-only">Loading chat</span>
        <div aria-hidden className="chat-page-loading__presence" />
      </div>
    </Page>
  );
}

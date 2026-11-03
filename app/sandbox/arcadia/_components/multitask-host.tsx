"use client";

import type { ReactNode } from "react";

import { useParams } from "next/navigation";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";

import { ArcadiaMultitaskProvider, useArcadiaMultitask } from "./multitask-provider";
import { ArcadiaMultitaskShell } from "./multitask-shell";
import { MultitaskDashboard } from "./multitask-dashboard";

/**
 * Keep {@link children} (Arcadia Chat) under one stable host so toggling
 * multitask does not remount the composer — remounts used to race blank-chat
 * auto-delete and wipe in-flight useChat state.
 */
function ArcadiaMultitaskLayout({ children }: { children: ReactNode }) {
  const { layoutMode } = useArcadiaMultitask();
  const dashboard = layoutMode === "dashboard";

  return (
    <div className="h-full w-full min-h-0 pt-14" data-arcadia-multitask-layout={layoutMode}>
      <MultitaskDashboard enabled={dashboard}>{children}</MultitaskDashboard>
      {!dashboard ? <ArcadiaMultitaskShell /> : null}
    </div>
  );
}

/** What the thread page knows about itself and its orchestrator, read on the server. */
export type ArcadiaThreadMetaProps = {
  threadId: string;
  orchestratorThreadId: string;
  viewingSubagentId?: string;
  initialMultitaskView: boolean;
  initialHasSubagentThreads?: boolean;
};

const RegisterThreadMetaContext = createContext<((meta: ArcadiaThreadMetaProps) => void) | null>(
  null
);

/**
 * Rendered by each thread page. Hands the page's server-read context to the host, which lives in
 * the layout and so outlives the page: switching threads changes this, not the board.
 */
export function ArcadiaThreadMeta({
  threadId,
  orchestratorThreadId,
  viewingSubagentId,
  initialMultitaskView,
  initialHasSubagentThreads,
}: ArcadiaThreadMetaProps) {
  const register = useContext(RegisterThreadMetaContext);

  useLayoutEffect(() => {
    register?.({
      threadId,
      orchestratorThreadId,
      viewingSubagentId,
      initialMultitaskView,
      initialHasSubagentThreads,
    });
  }, [
    register,
    threadId,
    orchestratorThreadId,
    viewingSubagentId,
    initialMultitaskView,
    initialHasSubagentThreads,
  ]);

  return null;
}

/**
 * Mounts the multitask board around Arcadia chat from `app/sandbox/arcadia/layout.tsx`, above the
 * `[slug]` segment, so it survives switching between an orchestrator and its subagents' threads.
 * Only the thread page below it remounts. A different orchestrator is a different board, so that
 * (and only that) remounts the host.
 */
export function ArcadiaPersistentHost({ children }: { children: ReactNode }) {
  const slug = useParams<{ slug?: string }>()?.slug ?? "";
  const [meta, setMeta] = useState<ArcadiaThreadMetaProps | null>(null);
  const [board, setBoard] = useState(0);
  const orchestratorRef = useRef<string | null>(null);

  const register = useCallback((next: ArcadiaThreadMetaProps) => {
    // The first registration only fills in what the host guessed from the URL.
    if (orchestratorRef.current !== null && orchestratorRef.current !== next.orchestratorThreadId) {
      setBoard((count) => count + 1);
    }
    orchestratorRef.current = next.orchestratorThreadId;
    setMeta(next);
  }, []);

  return (
    <RegisterThreadMetaContext.Provider value={register}>
      <ArcadiaMultitaskProvider
        key={board}
        initialHasSubagentThreads={meta?.initialHasSubagentThreads}
        initialMultitaskView={meta?.initialMultitaskView ?? false}
        orchestratorThreadId={meta?.orchestratorThreadId}
        threadId={meta?.threadId ?? slug}
        viewingSubagentId={meta?.viewingSubagentId}
      >
        <ArcadiaMultitaskLayout>{children}</ArcadiaMultitaskLayout>
      </ArcadiaMultitaskProvider>
    </RegisterThreadMetaContext.Provider>
  );
}

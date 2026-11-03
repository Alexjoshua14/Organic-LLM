"use client";

import type { ReactNode } from "react";

import { useParams } from "next/navigation";
import { createContext, useContext, useLayoutEffect, useState } from "react";

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
 * `[slug]` segment, so it survives switching threads. Only the thread page below it remounts. The
 * provider resets its own board when the orchestrator changes, so a different orchestrator never
 * remounts the page (a remount would mount the new Chat twice).
 */
export function ArcadiaPersistentHost({ children }: { children: ReactNode }) {
  const slug = useParams<{ slug?: string }>()?.slug ?? "";
  const [meta, setMeta] = useState<ArcadiaThreadMetaProps | null>(null);

  return (
    <RegisterThreadMetaContext.Provider value={setMeta}>
      <ArcadiaMultitaskProvider
        awaitingThread={meta === null}
        initialHasSubagentThreads={meta?.initialHasSubagentThreads}
        initialMultitaskView={meta?.initialMultitaskView ?? false}
        orchestratorThreadId={meta?.orchestratorThreadId}
        threadId={slug || meta?.threadId || ""}
        viewingSubagentId={meta?.viewingSubagentId}
      >
        <ArcadiaMultitaskLayout>{children}</ArcadiaMultitaskLayout>
      </ArcadiaMultitaskProvider>
    </RegisterThreadMetaContext.Provider>
  );
}

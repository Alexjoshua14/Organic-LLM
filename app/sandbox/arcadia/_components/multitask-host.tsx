"use client";

import type { ReactNode } from "react";

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

type ArcadiaMultitaskHostProps = {
  threadId: string;
  initialMultitaskView?: boolean;
  initialHasSubagentThreads?: boolean;
  orchestratorThreadId?: string;
  viewingSubagentId?: string;
  children: ReactNode;
};

/** Client boundary that mounts overlay or dashboard around Arcadia chat. */
export function ArcadiaMultitaskHost({
  threadId,
  initialMultitaskView = false,
  initialHasSubagentThreads,
  orchestratorThreadId,
  viewingSubagentId,
  children,
}: ArcadiaMultitaskHostProps) {
  return (
    <ArcadiaMultitaskProvider
      key={threadId}
      initialMultitaskView={initialMultitaskView}
      initialHasSubagentThreads={initialHasSubagentThreads}
      threadId={threadId}
      orchestratorThreadId={orchestratorThreadId}
      viewingSubagentId={viewingSubagentId}
    >
      <ArcadiaMultitaskLayout>{children}</ArcadiaMultitaskLayout>
    </ArcadiaMultitaskProvider>
  );
}

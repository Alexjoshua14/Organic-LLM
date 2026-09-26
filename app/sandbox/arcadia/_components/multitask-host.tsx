"use client";

import type { ReactNode } from "react";

import { ArcadiaMultitaskProvider, useArcadiaMultitask } from "./multitask-provider";
import { ArcadiaMultitaskShell } from "./multitask-shell";
import { MultitaskDashboard } from "./multitask-dashboard";

function ArcadiaMultitaskLayout({ children }: { children: ReactNode }) {
  const { layoutMode } = useArcadiaMultitask();

  if (layoutMode === "dashboard") {
    return <MultitaskDashboard>{children}</MultitaskDashboard>;
  }

  return (
    <>
      {children}
      <ArcadiaMultitaskShell />
    </>
  );
}

type ArcadiaMultitaskHostProps = {
  threadId: string;
  initialMultitaskView?: boolean;
  children: ReactNode;
};

/** Client boundary that mounts overlay or dashboard around Arcadia chat. */
export function ArcadiaMultitaskHost({
  threadId,
  initialMultitaskView = false,
  children,
}: ArcadiaMultitaskHostProps) {
  return (
    <ArcadiaMultitaskProvider initialMultitaskView={initialMultitaskView} threadId={threadId}>
      <ArcadiaMultitaskLayout>{children}</ArcadiaMultitaskLayout>
    </ArcadiaMultitaskProvider>
  );
}

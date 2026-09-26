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

/** Client boundary that mounts overlay shell or running dashboard around Arcadia chat. */
export function ArcadiaMultitaskHost({ children }: { children: ReactNode }) {
  return (
    <ArcadiaMultitaskProvider>
      <ArcadiaMultitaskLayout>{children}</ArcadiaMultitaskLayout>
    </ArcadiaMultitaskProvider>
  );
}

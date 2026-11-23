"use client";

import type { ReactNode } from "react";

import { LumenShell } from "@coalescence-labs/design/lumen";

type HomeComposerLumenShellProps = {
  children: ReactNode;
  enabled?: boolean;
  className?: string;
};

/** Warm lumen rim behind the homepage prompt shell — separate layer, not on the glass surface. */
export function HomeComposerLumenShell({
  children,
  className,
  enabled = true,
}: HomeComposerLumenShellProps) {
  return (
    <LumenShell className={className} enabled={enabled} surface="[data-prompt-input-shell]">
      {children}
    </LumenShell>
  );
}

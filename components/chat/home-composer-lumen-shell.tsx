"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useHomeComposerLumen, useHomeComposerLumenHostRef } from "./use-home-composer-lumen";

type HomeComposerLumenShellProps = {
  children: ReactNode;
  className?: string;
};

/** Warm lumen rim behind the homepage prompt shell — separate layer, not on the glass surface. */
export function HomeComposerLumenShell({ children, className }: HomeComposerLumenShellProps) {
  const hostRef = useHomeComposerLumenHostRef();
  useHomeComposerLumen(hostRef);

  return (
    <span
      ref={hostRef}
      className={cn("home-composer-lumen-host flex w-full overflow-visible", className)}
    >
      <span className="home-composer-lumen-stage relative w-full overflow-visible">
        <span aria-hidden className="home-composer-lumen-rim" />
        <div className="relative z-10 w-full">{children}</div>
      </span>
    </span>
  );
}

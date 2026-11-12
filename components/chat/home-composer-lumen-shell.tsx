"use client";

import type { ReactNode } from "react";

import { useHomeComposerLumen, useHomeComposerLumenHostRef } from "./use-home-composer-lumen";

import { cn } from "@/lib/utils";

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
  const hostRef = useHomeComposerLumenHostRef();

  useHomeComposerLumen(hostRef, enabled);

  return (
    <span
      ref={hostRef}
      className={cn("home-composer-lumen-host flex w-full overflow-visible", className)}
    >
      <span className="home-composer-lumen-stage relative w-full overflow-visible">
        {enabled ? <span aria-hidden className="home-composer-lumen-rim" /> : null}
        <div className="relative z-10 w-full">{children}</div>
      </span>
    </span>
  );
}

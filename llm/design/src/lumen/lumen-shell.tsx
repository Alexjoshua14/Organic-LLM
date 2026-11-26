"use client";

import type { ReactNode } from "react";

import { useLumenRim, useLumenRimHostRef } from "./use-lumen-rim";

export type LumenShellProps = {
  children: ReactNode;
  /** Show the rim (dark) and shadow (light). Defaults to `true`. */
  enabled?: boolean;
  /** Extra classes for the host, e.g. `home-composer-lumen-host--interactive`. */
  className?: string;
  /** Selector for the lit surface inside the shell. Defaults to `[data-lumen-surface]`. */
  surface?: string;
};

/**
 * Shell rim: a warm Lumen rim behind a large surface such as a prompt input (dark), or a soft
 * shadow under it (light). The rim is a separate layer, never on the surface's own fill, and is
 * sized from the surface's resting height so a growing composer keeps the same glow.
 */
export function LumenShell({
  children,
  className,
  enabled = true,
  surface = "[data-lumen-surface]",
}: LumenShellProps) {
  const hostRef = useLumenRimHostRef();

  useLumenRim(hostRef, { target: surface, radius: "shell", enabled, holdRestingHeight: true });

  return (
    <span
      ref={hostRef}
      className={className ? `home-composer-lumen-host ${className}` : "home-composer-lumen-host"}
    >
      <span className="home-composer-lumen-stage">
        {enabled ? <span aria-hidden className="home-composer-lumen-rim" /> : null}
        <div className="home-composer-lumen-content">{children}</div>
      </span>
    </span>
  );
}

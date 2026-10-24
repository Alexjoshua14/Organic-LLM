"use client";
import React from "react";

import { useSidebar } from "../third-party/ui/sidebar";

import { TTSDockBar } from "@/lib/context/tts-context";
import { cn } from "@/lib/utils";

type PageChrome = "inset" | "full-bleed";

type PageProps = {
  children: React.ReactNode;
  transparentBackground?: boolean;
  /** SSR gradient fill for transparent pages with AdaptiveLiquidChrome — avoids flash before WebGL hydrates. */
  liquidChromeBackground?: boolean;
  /** Inset adds the raised card chrome when the sidebar is open; full-bleed keeps edge-to-edge layout. */
  chrome?: PageChrome;
  className?: string;
};

export default function Page({
  children,
  transparentBackground,
  liquidChromeBackground,
  chrome = "inset",
  className,
}: PageProps) {
  const { open } = useSidebar();
  const insetChrome = chrome === "inset";

  return (
    <section
      data-page-chrome={chrome}
      className={cn(
        "app-shell relative",
        `h-dvh w-full max-w-dvw overflow-x-hidden page-transform`,
        !transparentBackground && !liquidChromeBackground && "bg-background",
        liquidChromeBackground && "page-liquid-chrome",
        "text-primary",
        insetChrome && "md:inset-shadow-xs",
        "flex flex-col items-center justify-center gap-4",
        open &&
          insetChrome &&
          "md:mt-4 md:h-[calc(100dvh-1rem)] md:rounded-tl-xl md:border-l-1 md:border-t-1 md:border-border",
        className
      )}
    >
      {liquidChromeBackground ? (
        <div
          aria-hidden
          className="liquid-chrome-page-fill pointer-events-none fixed inset-0 z-0"
        />
      ) : null}
      {children}
      <TTSDockBar />
    </section>
  );
}

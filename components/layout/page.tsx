"use client";
import React from "react";

import { useSidebar } from "../third-party/ui/sidebar";

import { TTSDockBar } from "@/lib/context/tts-context";
import { cn } from "@/lib/utils";

type PageChrome = "inset" | "full-bleed";

type PageProps = {
  children: React.ReactNode;
  transparentBackground?: boolean;
  /** Inset adds the raised card chrome when the sidebar is open; full-bleed keeps edge-to-edge layout. */
  chrome?: PageChrome;
  className?: string;
};

export default function Page({
  children,
  transparentBackground,
  chrome = "inset",
  className,
}: PageProps) {
  const { open } = useSidebar();
  const insetChrome = chrome === "inset";

  return (
    <section
      data-page-chrome={chrome}
      className={cn(
        "relative",
        `h-dvh w-full max-w-dvw overflow-x-hidden page-transform`,
        !transparentBackground && "bg-background",
        "text-primary",
        insetChrome && "md:inset-shadow-xs",
        "flex flex-col items-center justify-center gap-4",
        open &&
          insetChrome &&
          "md:mt-4 md:h-[calc(100dvh-1rem)] md:rounded-tl-xl md:border-l-1 md:border-t-1 md:border-border",
        className
      )}
    >
      {children}
      <TTSDockBar />
    </section>
  );
}

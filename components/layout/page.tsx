"use client";
import React from "react";

import { useSidebar } from "../third-party/ui/sidebar";

import { TTSDockBar } from "@/lib/context/tts-context";
import { cn } from "@/lib/utils";

type PageProps = {
  children: React.ReactNode;
  transparentBackground?: boolean;
  className?: string;
};

export default function Page({ children, transparentBackground, className }: PageProps) {
  const { open } = useSidebar();

  return (
    <section
      className={cn(
        "relative",
        `h-dvh w-full max-w-dvw overflow-x-hidden page-transform`,
        !transparentBackground && "bg-background",
        "text-primary",
        "md:inset-shadow-xs",
        "flex flex-col items-center justify-center gap-4",
        `${open ? "md:mt-4 md:h-[calc(100dvh-1rem)] md:rounded-tl-xl md:border-l-1 md:border-t-1 md:border-border" : ""}`,
        className
      )}
    >
      {children}
      <TTSDockBar />
    </section>
  );
}

import React from "react";

import { cn } from "@/lib/utils";

type PageProps = {
  children: React.ReactNode;
  transparentBackground?: boolean;
  className?: string;
};

export default function Page({
  children,
  transparentBackground,
  className,
}: PageProps) {
  return (
    <section
      className={cn(
        "app-shell relative",
        "h-dvh md:h-[calc(100dvh-1rem)] w-full max-w-dvw overflow-x-hidden",
        !transparentBackground && "bg-background",
        "text-primary",
        "md:rounded-tl-xl md:inset-shadow-xs",
        "flex flex-col items-center justify-center gap-4",
        "md:border-l-1 md:border-t-1 md:border-border",
        className,
      )}
    >
      {children}
    </section>
  );
}

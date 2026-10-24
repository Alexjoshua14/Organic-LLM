"use client";

import type { ButtonHTMLAttributes } from "react";

import { HomeComposerLumenShell } from "./home-composer-lumen-shell";

import { homeComposerGlassSurface } from "@/components/design-system/primitives";
import { InputGroup } from "@/components/third-party/ui/input-group";
import { cn } from "@/lib/utils";

type HomeComposerActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Homepage primary action — same shell stack as the main composer:
 * lumen rim + InputGroup glass surface + transparent control.
 */
export function HomeComposerActionButton({
  className,
  children,
  ...props
}: HomeComposerActionButtonProps) {
  return (
    <HomeComposerLumenShell className="home-composer-lumen-host--interactive inline-flex w-auto">
      <InputGroup
        className={cn(homeComposerGlassSurface, "inline-flex h-auto w-auto")}
        data-prompt-input-shell
      >
        <button
          type="button"
          className={cn(
            "w-full cursor-pointer border-0 bg-transparent px-4 py-2.5 shadow-none outline-none",
            "text-sm font-medium tracking-tight text-foreground",
            "transition-opacity duration-200",
            "focus-visible:ring-2 focus-visible:ring-border/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "disabled:pointer-events-none disabled:opacity-50",
            className
          )}
          {...props}
        >
          {children}
        </button>
      </InputGroup>
    </HomeComposerLumenShell>
  );
}

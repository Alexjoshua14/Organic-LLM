"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type SignedOutAuthButtonsProps = {
  className?: string;
  size?: "default" | "compact";
};

export function SignedOutAuthButtons({ className, size = "default" }: SignedOutAuthButtonsProps) {
  const compact = size === "compact";

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      <SignInButton mode="modal">
        <button
          className={cn(
            glass({ opaque: true }),
            "rounded-full border border-border/60 px-5 font-medium text-foreground transition-opacity hover:opacity-90",
            compact ? "h-9 text-sm" : "h-10 text-sm sm:h-11 sm:text-base"
          )}
          type="button"
        >
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button
          className={cn(
            "rounded-full bg-[#6c47ff] font-medium text-white transition-opacity hover:opacity-90",
            compact ? "h-9 px-4 text-sm" : "h-10 px-5 text-sm sm:h-11 sm:px-6 sm:text-base"
          )}
          type="button"
        >
          Sign up
        </button>
      </SignUpButton>
    </div>
  );
}



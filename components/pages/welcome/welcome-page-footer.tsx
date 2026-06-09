"use client";

import Link from "next/link";

import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

type WelcomePageFooterProps = {
  className?: string;
};

export function WelcomePageFooter({ className }: WelcomePageFooterProps) {
  const { footer } = welcomeCopy;
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn("py-8 sm:py-10", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <p className="font-commissioner text-base font-light tracking-tight text-foreground">
          {footer.organization}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{footer.tagline}</p>
        <div className="mt-5 flex flex-col gap-2 text-xs text-muted-foreground/80 sm:flex-row sm:items-center sm:gap-4">
          <Link
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            href={footer.privacy.href}
          >
            {footer.privacy.label}
          </Link>
          <span aria-hidden className="hidden text-border sm:inline">
            ·
          </span>
          <span>© {year} {footer.organization}</span>
        </div>
      </div>
    </footer>
  );
}

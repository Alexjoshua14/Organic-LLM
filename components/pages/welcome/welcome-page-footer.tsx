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
    <footer className={cn("pt-40 pb-8 sm:pb-10", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:px-8 lg:px-12">
        <div className="min-w-0 text-left">
          <p className="font-commissioner text-base font-light tracking-tight text-foreground">
            {footer.organization}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{footer.tagline}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 text-xs text-muted-foreground/80 sm:items-end sm:text-right">
          <Link
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            href={footer.privacy.href}
          >
            {footer.privacy.label}
          </Link>
          <span>
            © {year} {footer.organization}
          </span>
        </div>
      </div>
    </footer>
  );
}

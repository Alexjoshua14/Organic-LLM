"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { useSidebar } from "@/components/third-party/ui/sidebar";
import { cn } from "@/lib/utils";

type BackToHomeButtonProps = {
  className?: string;
};

/**
 * Renders a "Back to homepage" link when the sidebar is collapsed or on mobile,
 * so users can navigate home without opening the sidebar.
 */
export function BackToHomeButton({ className }: BackToHomeButtonProps) {
  const { open, isMobile } = useSidebar();

  const show = isMobile || !open;

  if (!show) return null;

  return (
    <Link
      className={cn(
        "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
      href="/"
    >
      <ChevronLeft aria-hidden className="size-4 shrink-0" />
      <span>Home</span>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function ArrowSvg({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M13 7l5 5m0 0l-5 5m5-5H6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

export type GatewaySmokeLinkProps = {
  href: string;
  label: string;
  ariaLabel: string;
  showArrow?: boolean;
  motionDelay?: number;
  className?: string;
};

export const gatewaySmokeSurface = cn(
  "group inline-flex items-center gap-2 rounded-xl px-4 py-2.5",
  "text-sm font-medium tracking-tight text-foreground no-underline",
  glass({ opaque: true }),
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]",
  "outline-none transition-[transform,opacity,box-shadow] duration-200 ease-out",
  "hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.16)]",
  "focus-visible:ring-2 focus-visible:ring-border/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
  "motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
);

/** Admin home gateway link — unified smoke glass surface (no lumen). */
export function GatewaySmokeLink({
  href,
  label,
  ariaLabel,
  showArrow = false,
  motionDelay,
  className,
}: GatewaySmokeLinkProps) {
  const link = (
    <Link
      aria-label={ariaLabel}
      className={cn(gatewaySmokeSurface, className)}
      data-dim-background="full"
      href={href}
    >
      {label}
      {showArrow ? (
        <ArrowSvg className="h-4 w-4 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
      ) : null}
    </Link>
  );

  if (motionDelay === undefined) {
    return link;
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="inline-flex"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{
        duration: 0.6,
        delay: motionDelay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {link}
    </motion.div>
  );
}

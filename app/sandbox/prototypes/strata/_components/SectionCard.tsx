import type { ReactNode, RefObject } from "react";

import { motion } from "framer-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const sectionVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
} as const;

export function SectionCard({
  title,
  subtitle,
  children,
  sectionRef,
  variant = "default",
  className,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  sectionRef?: RefObject<HTMLElement | null>;
  variant?: "default" | "notes" | "editorial" | "system";
  className?: string;
}) {
  const variantClass =
    variant === "notes"
      ? cn(glass({ opaque: true }), "border border-border/70 backdrop-blur-xl")
      : variant === "editorial"
        ? cn(glass({ tone: "brown", opaque: true }), "border border-border/60 backdrop-blur-xl")
        : variant === "system"
          ? cn(glass(), "border border-border/40 backdrop-blur-xl opacity-90")
          : cn(glass(), "border backdrop-blur-xl");

  return (
    <motion.section
      ref={sectionRef as RefObject<HTMLElement>}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      variants={sectionVariants}
      className={cn(
        "min-h-[82dvh] rounded-xl p-5 sm:p-6",
        "flex flex-col gap-4",
        variantClass,
        className
      )}
    >
      <header className="space-y-1">
        <h2
          className={cn(
            "text-lg font-semibold text-foreground",
            variant === "editorial" && "text-xl sm:text-2xl font-medium tracking-tight"
          )}
        >
          {title}
        </h2>
        <p className={cn("text-sm text-muted-foreground", variant === "system" && "text-xs")}>
          {subtitle}
        </p>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.section>
  );
}

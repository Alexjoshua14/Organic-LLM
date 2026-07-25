"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type GenUiGalleryNavProps = {
  count: number;
  activeIndex: number;
  labels: string[];
  onSelectIndex: (index: number) => void;
};

export function GenUiGalleryNav({
  count,
  activeIndex,
  labels,
  onSelectIndex,
}: GenUiGalleryNavProps) {
  const reducedMotion = useReducedMotion();

  return (
    <nav
      aria-label="Gallery sections"
      className="pointer-events-none absolute inset-y-0 right-3 z-10 hidden items-center sm:flex"
    >
      <ul className="pointer-events-auto flex flex-col gap-2.5">
        {Array.from({ length: count }).map((_, index) => {
          const active = index === activeIndex;

          return (
            <li key={index}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                aria-label={labels[index] ?? `Section ${index + 1}`}
                className="group flex size-5 items-center justify-center"
                onClick={() => onSelectIndex(index)}
              >
                <motion.span
                  animate={{
                    scale: active ? 1 : 0.85,
                    opacity: active ? 1 : 0.45,
                  }}
                  className={cn(
                    "block size-2 rounded-full border border-foreground/30 bg-foreground/20 transition-colors",
                    active && "border-primary/50 bg-primary"
                  )}
                  initial={false}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: 0.35, ease: [0.23, 1, 0.32, 1] }
                  }
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

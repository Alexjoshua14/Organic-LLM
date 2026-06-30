"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import { cn } from "@/lib/utils";

const SEARCH_SPRING = { type: "spring" as const, stiffness: 420, damping: 34 };

type ErgonExpandableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function ErgonExpandableSearch({ value, onChange, className }: ErgonExpandableSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const isExpanded = expanded || value.length > 0;
  const transition = reduceMotion ? { duration: 0 } : SEARCH_SPRING;

  useEffect(() => {
    if (!isExpanded) return;

    inputRef.current?.focus();
  }, [isExpanded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || value.trim()) return;

      setExpanded(false);
      inputRef.current?.blur();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [value]);

  useEffect(() => {
    if (!isExpanded) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (value.trim()) return;

      setExpanded(false);
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isExpanded, value]);

  return (
    <div ref={rootRef} className={cn("hidden shrink-0 md:block", className)}>
      <motion.div
        className="ml-auto flex select-none flex-row-reverse items-center overflow-hidden rounded-lg border border-border/60 bg-muted/30"
        initial={false}
        animate={{ width: isExpanded ? 200 : 32 }}
        transition={transition}
      >
        <Button
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Close search" : "Open search"}
          className="size-8 shrink-0 rounded-md"
          size="icon"
          type="button"
          variant="ghost"
          onPointerDown={(event) => {
            // Prevent input blur before click — otherwise blur collapses first and click re-opens.
            if (isExpanded && !value.trim()) event.preventDefault();
          }}
          onClick={() => {
            if (isExpanded && !value.trim()) {
              setExpanded(false);
              inputRef.current?.blur();

              return;
            }

            setExpanded(true);
          }}
        >
          <Search className="size-3.5" />
        </Button>
        {isExpanded ? (
          <Input
            ref={inputRef}
            aria-label="Search tasks"
            className="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm shadow-none placeholder:select-none focus-visible:ring-0"
            placeholder="Search tasks…"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
              if (!value.trim()) setExpanded(false);
            }}
          />
        ) : null}
      </motion.div>
    </div>
  );
}

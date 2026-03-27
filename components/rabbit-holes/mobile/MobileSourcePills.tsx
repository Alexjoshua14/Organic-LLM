"use client";

import type { RabbitHoleSource } from "@/lib/schemas/rabbitHoleSchemas";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface MobileSourcePillsProps {
  sources: RabbitHoleSource[];
  onSourceClick: (source: RabbitHoleSource) => void;
}

export function MobileSourcePills({ sources, onSourceClick }: MobileSourcePillsProps) {
  if (sources.length === 0) return null;

  return (
    <div className="rabbit-hole-mobile-source-pills -mx-1 px-1">
      <p className="font-commissioner mb-2 text-[10px] font-light uppercase tracking-[0.2em] text-muted-foreground">
        Sources
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sources.map((source, index) => (
          <motion.button
            key={source.id}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "rabbit-hole-mobile-source-pill shrink-0 snap-start snap-always",
              "flex h-11 max-w-[220px] min-w-[120px] items-center gap-2 rounded-lg border border-border/60",
              "bg-card/70 px-3 text-left backdrop-blur-sm transition-colors active:bg-card/90"
            )}
            initial={{ opacity: 0, x: 12 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
            type="button"
            onClick={() => onSourceClick(source)}
          >
            {source.faviconUrl ? (
              // External favicon URLs — next/image would require remotePatterns per domain
              // eslint-disable-next-line @next/next/no-img-element -- dynamic third-party favicons
              <img
                alt=""
                className="size-4 shrink-0 opacity-80"
                src={source.faviconUrl}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="size-4 shrink-0 rounded-sm bg-muted/50" />
            )}
            <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
              {source.title}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

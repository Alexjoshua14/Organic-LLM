"use client";

import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

import { motion } from "framer-motion";
import { Trash2, ArrowRight } from "lucide-react";

import { formatDate } from "@/lib/format/stringFormatting";
import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ShinyText";

export interface SessionCardProps {
  session: RabbitHoleSessionMetadata;
  onDelete?: (sessionId: string, e: React.MouseEvent) => void;
  onClick?: (sessionId: string) => void;
  showDelete?: boolean;
  deletingId?: string | null;
  /** Optional animation delay index (e.g. index * 0.05) */
  transitionDelay?: number;
}

export function SessionCard({
  session,
  onDelete,
  onClick,
  showDelete = true,
  deletingId = null,
  transitionDelay = 0,
}: SessionCardProps) {
  const isDeleting = deletingId === session.sessionId;
  const isInteractive = !!onClick;

  return (
    <motion.div
      key={session.sessionId}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm",
        "transition-all group",
        isInteractive && "hover:shadow-md cursor-pointer"
      )}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: transitionDelay }}
      onClick={() => isInteractive && onClick?.(session.sessionId)}
    >
      {isInteractive && (
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-accent/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-active:opacity-100" />
      )}
      <div className="p-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-commissioner text-lg font-light text-foreground mb-2 line-clamp-2">
            <ShinyText
              accentShimmer
              as="span"
              className="cursor-inherit"
              disabled={!isInteractive}
              shimmerOnParentGroupHover
              speed={2.8}
              text={session.rootTitle?.trim() || RABBIT_HOLE_UNTITLED}
            />
          </h3>
          {session.summary && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{session.summary}</p>
          )}
          <div className="flex items-center gap-4 text-xs font-light tracking-[0.01em] text-muted-foreground/70 [font-family:var(--font-inter)] [font-variation-settings:'wght'_330]">
            <span>{formatDate(session.updatedAt)}</span>
            <span>•</span>
            <span>
              {session.pathLength} level{session.pathLength !== 1 ? "s" : ""} explored
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showDelete && onDelete && (
            <button
              className="p-2 rounded-md text-muted-foreground opacity-100 transition-opacity hover:text-destructive hover:bg-card/30 md:opacity-0 md:group-hover:opacity-100"
              disabled={isDeleting}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.sessionId, e);
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
          {isInteractive && (
            <span className="relative inline-grid size-8 place-items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <ArrowRight
                className="text-muted-foreground transition-colors duration-200 group-hover:text-foreground"
                size={16}
              />
              <span className="pointer-events-none absolute inset-1 rounded-full bg-linear-to-r from-transparent via-accent/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-active:opacity-100" />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

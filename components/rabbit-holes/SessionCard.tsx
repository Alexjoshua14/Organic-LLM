"use client";

import { motion } from "framer-motion";
import { Trash2, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format/stringFormatting";
import { cn } from "@/lib/utils";
import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: transitionDelay }}
      className={cn(
        "bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm",
        "transition-all group",
        isInteractive && "hover:shadow-md cursor-pointer",
      )}
      onClick={() => isInteractive && onClick?.(session.sessionId)}
    >
      <div className="p-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-commissioner text-lg font-light text-foreground mb-2 line-clamp-2">
            {session.rootQuestion}
          </h3>
          {session.summary && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {session.summary}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{formatDate(session.updatedAt)}</span>
            <span>•</span>
            <span>
              {session.pathLength} level{session.pathLength !== 1 ? "s" : ""}{" "}
              explored
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showDelete && onDelete && (
            <button
              type="button"
              className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-card/30 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.sessionId, e);
              }}
              disabled={isDeleting}
            >
              <Trash2 size={16} />
            </button>
          )}
          {isInteractive && (
            <ArrowRight
              size={16}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

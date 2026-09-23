import type { KanbanPriority, KanbanStatus } from "@/lib/schemas/kanban";

import { memo } from "react";

import { cn } from "@/lib/utils";

/** Color only where it means something: warm for Active, red for Blocked, teal for Done. */
export const STATUS_TONE: Record<KanbanStatus, string> = {
  backlog: "text-muted-foreground/70",
  todo: "text-muted-foreground",
  active: "text-[oklch(0.68_0.13_58)] dark:text-lumen",
  in_review: "text-foreground/60",
  blocked: "text-rose-500 dark:text-rose-400",
  done: "text-accent",
};

/** Dot-light fill for minimaps, same meaning map as `STATUS_TONE`. */
export const STATUS_DOT: Record<KanbanStatus, string> = {
  backlog: "bg-foreground/20",
  todo: "bg-foreground/30",
  active: "bg-[rgb(var(--lumen))] shadow-[0_0_6px_rgb(var(--lumen)/0.9)]",
  in_review: "bg-foreground/45",
  blocked: "bg-rose-500 shadow-[0_0_6px_rgb(244_63_94/0.55)]",
  done: "bg-accent",
};

/** Shape carries status too, so meaning never rests on color alone. */
export const StatusGlyph = memo(function StatusGlyph({
  status,
  size = 14,
  className,
}: {
  status: KanbanStatus;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      className={cn("shrink-0", STATUS_TONE[status], className)}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 14 14"
      width={size}
    >
      {status === "done" ? (
        <>
          <circle cx="7" cy="7" fill="currentColor" r="6" stroke="none" />
          <path
            d="M4.4 7.2 6.2 8.9 9.6 5.3"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.6}
          />
        </>
      ) : (
        <circle
          cx="7"
          cy="7"
          r="5.5"
          strokeDasharray={status === "backlog" ? "2.2 2.1" : undefined}
        />
      )}
      {status === "active" ? (
        <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" stroke="none" />
      ) : null}
      {status === "in_review" ? (
        <path d="M7 7V3.5a3.5 3.5 0 1 1-3.5 3.5z" fill="currentColor" stroke="none" />
      ) : null}
      {status === "blocked" ? <path d="M3.4 10.6 10.6 3.4" strokeLinecap="round" /> : null}
    </svg>
  );
});

const PRIORITY_LEVEL: Record<Exclude<KanbanPriority, "urgent">, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** Signal bars for low / medium / high; a red mark only for urgent. */
export const PriorityGlyph = memo(function PriorityGlyph({
  priority,
  className,
}: {
  priority: KanbanPriority;
  className?: string;
}) {
  const label = `${priority[0].toUpperCase()}${priority.slice(1)} priority`;

  if (priority === "urgent") {
    return (
      <svg
        aria-label={label}
        className={cn("shrink-0 text-rose-500", className)}
        height={12}
        role="img"
        viewBox="0 0 12 12"
        width={12}
      >
        <rect fill="currentColor" height="11" rx="3" width="11" x="0.5" y="0.5" />
        <path d="M6 3v3.6" stroke="white" strokeLinecap="round" strokeWidth="1.5" />
        <circle cx="6" cy="8.7" fill="white" r="0.85" />
      </svg>
    );
  }

  const level = PRIORITY_LEVEL[priority];

  return (
    <svg
      aria-label={label}
      className={cn("shrink-0 text-foreground/65", className)}
      height={12}
      role="img"
      viewBox="0 0 12 12"
      width={12}
    >
      {[0, 1, 2].map((bar) => (
        <rect
          key={bar}
          fill="currentColor"
          height={3 + bar * 3}
          opacity={bar < level ? 1 : 0.22}
          rx="0.75"
          width="2.5"
          x={1 + bar * 3.75}
          y={8 - bar * 3}
        />
      ))}
    </svg>
  );
});

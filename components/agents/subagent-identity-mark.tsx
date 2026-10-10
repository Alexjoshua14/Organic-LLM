import type { SubagentIdentityImageRecord } from "@/lib/schemas/subagent-runtime";

import { cn } from "@/lib/utils";

type SubagentIdentityMarkProps = {
  /** Stored identity image URL; when absent, renders an empty mark slot. */
  imageUrl?: string | null;
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const;

/**
 * Presentational abstract identity mark for condensed subagent cards.
 * Bind {@link SubagentIdentityImageRecord.url} (or `ArcadiaSubagent.identityImageUrl`).
 */
export function SubagentIdentityMark({
  imageUrl,
  name,
  className,
  size = "md",
}: SubagentIdentityMarkProps) {
  return (
    <div
      aria-label={`${name} identity mark`}
      className={cn(
        SIZE_CLASS[size],
        "shrink-0 overflow-hidden rounded-lg border border-border/40 bg-background/50",
        className
      )}
      role="img"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- may be file://, data:, or remote
        <img alt="" className="size-full object-cover" src={imageUrl} />
      ) : null}
    </div>
  );
}

export type { SubagentIdentityImageRecord };

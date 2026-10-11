import type { AgentDotState } from "./agent-dot-grid";

import { AdaptiveAgentDotGrid } from "./adaptive-agent-dot-grid";
import { AgentDotGrid } from "./agent-dot-grid";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type OrganicActivityMarkProps = {
  state?: AgentDotState;
  size?: "sm" | "md" | "lg";
  seed?: string;
  label?: string;
  className?: string;
  /** Select the original grid for comparisons; auto keeps all adaptive safeguards. */
  renderer?: "auto" | "v0";
  /** Compatibility with existing stored identity images, inside the lower layer. */
  imageUrl?: string | null;
};

const SIZE_CLASS = { sm: "size-8", md: "size-10", lg: "size-14" } as const;

/** Owns the local stack and all layer behavior; callers only supply state and dimensions. */
export function OrganicActivityMark({
  state = "idle",
  size = "md",
  seed,
  label,
  className,
  renderer = "auto",
  imageUrl,
}: OrganicActivityMarkProps) {
  return (
    <div
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        SIZE_CLASS[size],
        "relative isolate shrink-0 overflow-hidden rounded-lg",
        className
      )}
      role={label ? "img" : undefined}
    >
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- may be file://, data:, or remote
          <img alt="" className="size-full object-cover" src={imageUrl} />
        ) : renderer === "v0" ? (
          <AgentDotGrid seed={seed} state={state} />
        ) : (
          <AdaptiveAgentDotGrid seed={seed} state={state} />
        )}
      </div>
      <div
        aria-hidden
        className={cn(glass(), "pointer-events-none absolute inset-0 rounded-[inherit]")}
        style={{ zIndex: 1 }}
      />
    </div>
  );
}

export type { AgentDotState };

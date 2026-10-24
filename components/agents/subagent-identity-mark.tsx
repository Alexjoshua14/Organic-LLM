import type { SubagentIdentityImageRecord } from "@/lib/schemas/subagent-runtime";
import type { AgentDotState } from "./organic-activity-mark";

import { OrganicActivityMark } from "./organic-activity-mark";

type SubagentIdentityMarkProps = {
  /** Stored identity image URL; when absent, renders the layered activity mark. */
  imageUrl?: string | null;
  name: string;
  /** Stable seed derived from the agent's starting context. */
  seed?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  state?: AgentDotState;
  intensity?: number;
};

/**
 * Presentational abstract identity mark for condensed subagent cards.
 * Bind {@link SubagentIdentityImageRecord.url} (or `ArcadiaSubagent.identityImageUrl`).
 */
export function SubagentIdentityMark({
  imageUrl,
  name,
  seed = name,
  className,
  size = "md",
  state = "idle",
  intensity,
}: SubagentIdentityMarkProps) {
  return (
    <OrganicActivityMark
      className={className}
      imageUrl={imageUrl}
      intensity={intensity}
      label={`${name} identity mark`}
      seed={seed}
      size={size}
      state={state}
    />
  );
}

export type { SubagentIdentityImageRecord };

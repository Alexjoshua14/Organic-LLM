import type { SubagentIdentityImageRecord } from "@/lib/schemas/subagent-runtime";
import type { AgentDotState } from "./organic-activity-mark";

import { OrganicActivityMark } from "./organic-activity-mark";

type SubagentIdentityMarkProps = {
  /** Stored identity image URL; when absent, renders the layered activity mark. */
  imageUrl?: string | null;
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  state?: AgentDotState;
};

/**
 * Presentational abstract identity mark for condensed subagent cards.
 * Bind {@link SubagentIdentityImageRecord.url} (or `ArcadiaSubagent.identityImageUrl`).
 */
export function SubagentIdentityMark({
  imageUrl,
  name,
  className,
  size = "md",
  state = "idle",
}: SubagentIdentityMarkProps) {
  return (
    <OrganicActivityMark
      className={className}
      imageUrl={imageUrl}
      label={`${name} identity mark`}
      seed={name}
      size={size}
      state={state}
    />
  );
}

export type { SubagentIdentityImageRecord };

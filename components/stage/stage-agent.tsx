"use client";

import type { AgentDotState } from "@/components/agents/agent-dot-grid-motion";
import type { StageRect } from "@/lib/stage/schema";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { STAGE_AGENT_RECT } from "@/lib/stage/schema";
import { stageCellStyle } from "@/lib/stage/frame";

// Stage uses larger identities against open paper. Keep the native mark legible
// in both themes without changing the shared agent component's material presets.
export const STAGE_AGENT_GLASS = {
  idle: { opacity: 0.25, blur: 2.8, brightness: 1.1 },
  waiting: { opacity: 0.25, blur: 2.8, brightness: 1.1 },
  working: { opacity: 0.2, blur: 3, brightness: 1.2 },
  complete: { opacity: 0.22, blur: 3, brightness: 1.1 },
};

export function StageAgent({
  status,
  state,
  onFocus,
  rect = STAGE_AGENT_RECT,
}: {
  status: string;
  state: AgentDotState;
  designing?: boolean;
  onFocus: () => void;
  rect?: StageRect;
}) {
  return (
    <div className="stage-agent" data-agent-id="organic" style={stageCellStyle(rect)}>
      <button
        aria-label="Talk to Organic"
        className="stage-agent-button"
        type="button"
        onClick={onFocus}
      >
        <OrganicActivityMark
          className="stage-agent-mark"
          seed="organic-stage"
          state={state}
          glassByState={STAGE_AGENT_GLASS}
        />
      </button>
      <h1>Organic</h1>
      <p aria-live="polite" className="stage-agent-status">
        {status}
      </p>
    </div>
  );
}

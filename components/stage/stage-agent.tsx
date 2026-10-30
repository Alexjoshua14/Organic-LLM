"use client";

import type { AgentDotState } from "@/components/agents/agent-dot-grid-motion";
import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { STAGE_AGENT_RECT } from "@/lib/stage/schema";

export function StageAgent({
  status,
  state,
  designing,
  onFocus,
}: {
  status: string;
  state: AgentDotState;
  designing: boolean;
  onFocus: () => void;
}) {
  return (
    <div
      className="stage-agent"
      data-agent-id="organic"
      style={{
        gridColumn: `${STAGE_AGENT_RECT.x + 1} / span ${STAGE_AGENT_RECT.w}`,
        gridRow: `${STAGE_AGENT_RECT.y + 1} / span ${STAGE_AGENT_RECT.h}`,
      }}
    >
      <button
        aria-label="Talk to Organic"
        className="stage-agent-button"
        type="button"
        onClick={onFocus}
      >
        <OrganicActivityMark className="stage-agent-mark" seed="organic-stage" state={state} />
      </button>
      <h1>Organic</h1>
      <p aria-live="polite" className="stage-agent-status">
        {status}
      </p>
      {designing ? (
        <span aria-hidden className="stage-designer-trace">
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </div>
  );
}

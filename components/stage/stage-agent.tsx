"use client";

import type { ReactNode } from "react";
import type { AgentDotState } from "@/components/agents/agent-dot-grid-motion";
import type { StageRect } from "@/lib/stage/schema";

import { OrganicAgentMark } from "@/components/agents/organic-agent-mark";
import { STAGE_AGENT_RECT } from "@/lib/stage/schema";
import { stageCellStyle } from "@/lib/stage/frame";

export function StageAgent({
  status,
  state,
  onFocus,
  rect = STAGE_AGENT_RECT,
  hero,
  message,
  renderStatus,
}: {
  status: string;
  state: AgentDotState;
  onFocus: () => void;
  rect?: StageRect;
  /** Speak's center size; otherwise Stage's CSS sizes the mark. */
  hero?: boolean;
  message?: ReactNode;
  renderStatus?: (status: string) => ReactNode;
}) {
  return (
    <div className="stage-agent" data-agent-id="organic" style={stageCellStyle(rect)}>
      <button
        aria-label="Talk to Organic"
        className="stage-agent-button"
        type="button"
        onClick={onFocus}
      >
        <OrganicAgentMark
          className="stage-agent-mark"
          hero={hero}
          seed="organic-speak"
          state={state}
        />
      </button>
      <h1>Organic</h1>
      {message}
      {renderStatus?.(status) ??
        (message == null && (
          <p aria-live="polite" className="stage-agent-status">
            {status}
          </p>
        ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ArrowDown, Check, Circle, Zap } from "lucide-react";

import { HEARTBEAT_SCENARIOS } from "@/lib/showcase/multiagent/content";

export function HeartbeatDemo() {
  const [selected, setSelected] = useState(2);
  const scenario = HEARTBEAT_SCENARIOS[selected]!;

  return (
    <div className="ma-instrument">
      <div className="ma-instrument-bar">
        <span>HEARTBEAT / SIGNAL PATH</span>
        <span>Interactive · illustrative outcomes</span>
      </div>
      <div className="ma-scenario-picker" role="group" aria-label="Heartbeat scenario">
        {HEARTBEAT_SCENARIOS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="ma-heartbeat-body">
        <div className="ma-snapshots">
          <div>
            <span className="ma-mono">LAST NOTIFIED</span>
            <p>{scenario.before}</p>
          </div>
          <ArrowDown size={18} aria-hidden />
          <div className="ma-snapshot-current">
            <span className="ma-mono">CURRENT SNAPSHOT</span>
            <p>{scenario.after}</p>
          </div>
          <span className="ma-caption">
            Compact state, assignment and outcome excerpts. Not a full transcript.
          </span>
        </div>
        <ol className="ma-signal-path" aria-label="Evaluation path">
          <li data-active="true">
            <span className="ma-signal-node">
              <Check size={18} aria-hidden />
            </span>
            <div>
              <strong>Deterministic checks</strong>
              <p>Ownership → budget → target → children → cadence → digest → claim.</p>
              <span className="ma-code">
                {scenario.jev ? "changed · evaluation claimed" : "digest matches · early return"}
              </span>
            </div>
          </li>
          <li data-active={scenario.jev}>
            <span className="ma-signal-node">
              <Zap size={18} aria-hidden />
            </span>
            <div>
              <strong>Jev evaluates meaning</strong>
              <p>Is this change worth the orchestrator’s attention?</p>
              <span className="ma-code">
                {scenario.jev ? "model called · ZDR required" : "skipped · no model call"}
              </span>
            </div>
          </li>
          <li data-active={scenario.notify}>
            <span className="ma-signal-node">
              <Circle size={16} aria-hidden />
            </span>
            <div>
              <strong>Bring it into the conversation</strong>
              <p>Persist a system notice and queue the parent’s response.</p>
              <span className="ma-code">
                {scenario.notify ? "notice + queued reply" : "no interruption"}
              </span>
            </div>
          </li>
        </ol>
      </div>
      <div className="ma-verdict" aria-live="polite" aria-atomic="true">
        <span className="ma-status">{scenario.status}</span>
        <div>
          <h4>{scenario.title}</h4>
          <p>{scenario.detail}</p>
        </div>
      </div>
    </div>
  );
}

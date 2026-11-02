"use client";

import { useState } from "react";

import { SourceLink } from "./source-link";

import { SPECIALISTS } from "@/lib/showcase/multiagent/content";

export function SpecialistExplorer() {
  const [selected, setSelected] = useState(0);
  const agent = SPECIALISTS[selected]!;

  return (
    <div className="ma-specialists">
      <div className="ma-roster" role="group" aria-label="Explore a specialist">
        {SPECIALISTS.map((item, index) => (
          <button
            type="button"
            key={item.name}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <span className="ma-roster-glyph" aria-hidden>
              {item.glyph}
            </span>
            <span>
              <strong>{item.name}</strong>
              <small>{item.role}</small>
            </span>
            <span className="ma-roster-arrow" aria-hidden>
              ↗
            </span>
          </button>
        ))}
      </div>
      <div className="ma-specialist-detail" aria-live="polite" aria-atomic="true">
        <span className="ma-mono">
          {agent.kind} / {agent.role}
        </span>
        <h3>{agent.name}</h3>
        <p className="ma-specialist-lede">{agent.description}</p>
        <div className="ma-tool-tags">
          {agent.tools.map((tool) => (
            <span key={tool}>{tool}</span>
          ))}
        </div>
        <p>{agent.detail}</p>
        <SourceLink path={agent.source}>Explore {agent.name}’s implementation</SourceLink>
      </div>
    </div>
  );
}

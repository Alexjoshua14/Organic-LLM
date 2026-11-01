"use client";

import { useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";

import { CONTEXT_ITEMS } from "@/lib/showcase/multiagent/content";

export function ContextWorkbench() {
  const [selected, setSelected] = useState<string[]>(["words", "evidence", "rubric"]);
  const [history, setHistory] = useState<"fresh" | "continue">("fresh");
  const items = CONTEXT_ITEMS.filter((item) => selected.includes(item.id));
  const chars = items.reduce((sum, item) => sum + item.text.length, 0);

  return (
    <div className="ma-instrument ma-workbench">
      <div className="ma-instrument-bar">
        <span>CONTEXT WORKBENCH</span>
        <span>Local demonstration · fictional material</span>
      </div>
      <div className="ma-workbench-grid">
        <div className="ma-context-shelf">
          <div className="ma-panel-heading">
            <span className="ma-mono">01 / SELECT</span>
            <h3>What should Reed see?</h3>
            <p>Choose the material to attach. Everything else stays on the worktable.</p>
          </div>
          {CONTEXT_ITEMS.map((item) => (
            <label
              className="ma-context-item"
              key={item.id}
              data-selected={selected.includes(item.id)}
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id]
                  )
                }
              />
              <span className="ma-check" aria-hidden>
                {selected.includes(item.id) ? <Check size={14} /> : <Plus size={14} />}
              </span>
              <span>
                <strong>{item.label}</strong>
                <code>{item.ref}</code>
              </span>
            </label>
          ))}
          <fieldset className="ma-history">
            <legend>Worker history</legend>
            {(["fresh", "continue"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="worker-history"
                  checked={history === value}
                  onChange={() => setHistory(value)}
                />
                {value === "fresh" ? "Start fresh" : "Continue thread"}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="ma-context-envelope">
          <div className="ma-panel-heading">
            <span className="ma-mono">02 / INSPECT</span>
            <h3>A brief that stands alone.</h3>
          </div>
          <div className="ma-brief">
            <span className="ma-mono">TO REED / ECONOMY</span>
            <p>
              Check the streaming exporter. Preserve chunk ordering, identify failure cases, and
              return a minimal implementation with verification steps.
            </p>
          </div>
          <div className="ma-attached" aria-live="polite" aria-atomic="true">
            {items.length ? (
              items.map((item) => (
                <details key={item.id}>
                  <summary>
                    <span>{item.label}</span>
                    <span>{item.text.length} chars</span>
                  </summary>
                  <p>{item.text}</p>
                  <small>{item.note}</small>
                </details>
              ))
            ) : (
              <p className="ma-empty">
                Only the brief is attached. A worker never receives the whole worktable
                automatically.
              </p>
            )}
          </div>
          <div className="ma-manifest">
            <span>
              <b>{items.length}</b> selected items
            </span>
            <span>
              <b>{chars}</b> attached characters
            </span>
            <span>
              <b>{history}</b> history policy
            </span>
          </div>
          <div className="ma-envelope-footer">
            <ArrowRight size={17} aria-hidden />
            <p>
              Production <code>dryRun</code> includes persona, tool schemas, history and the
              assignment in its token and cost preflight. These counts describe only this example’s
              selected text.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

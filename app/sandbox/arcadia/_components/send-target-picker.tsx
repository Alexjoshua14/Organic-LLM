"use client";

import type { ArcadiaMultitaskSendTarget } from "@/lib/arcadia/multitask/layout-mode";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { glass } from "@/components/design-system/primitives";
import { formatSendTargetLabel } from "@/lib/arcadia/multitask/layout-mode";
import { cn } from "@/lib/utils";

type SendTargetPickerProps = {
  agents: ArcadiaSubagent[];
  sendTarget: ArcadiaMultitaskSendTarget;
  onChange: (next: ArcadiaMultitaskSendTarget) => void;
  className?: string;
  compact?: boolean;
};

/**
 * Explicit composer destination: orchestrator thread vs a chosen subagent.
 * Does not disable the composer while workers run.
 */
export function SendTargetPicker({
  agents,
  sendTarget,
  onChange,
  className,
  compact = false,
}: SendTargetPickerProps) {
  const label = formatSendTargetLabel(sendTarget, agents);

  if (compact) {
    return (
      <label className={cn("flex min-h-11 min-w-0 items-center gap-3", className)}>
        <span className="shrink-0 text-xs text-muted-foreground">Send to</span>
        <select
          aria-label="Message recipient"
          className="min-h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          value={sendTarget.kind === "orchestrator" ? "orchestrator" : sendTarget.agentId}
          onChange={(event) =>
            onChange(
              event.target.value === "orchestrator"
                ? { kind: "orchestrator" }
                : { kind: "subagent", agentId: event.target.value }
            )
          }
        >
          <option value="orchestrator">Orchestrator</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "flex flex-col gap-2 rounded-xl border border-border/50 px-3 py-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Send to</p>
        <p className="truncate text-xs font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            sendTarget.kind === "orchestrator"
              ? "border-amber-800/35 bg-amber-900/10 text-foreground"
              : "border-border/50 bg-background/40 text-muted-foreground hover:bg-background/70"
          )}
          type="button"
          onClick={() => onChange({ kind: "orchestrator" })}
        >
          Orchestrator
        </button>
        {agents.map((agent) => {
          const active = sendTarget.kind === "subagent" && sendTarget.agentId === agent.id;

          return (
            <button
              key={agent.id}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-amber-800/35 bg-amber-900/10 text-foreground"
                  : "border-border/50 bg-background/40 text-muted-foreground hover:bg-background/70"
              )}
              type="button"
              onClick={() => onChange({ kind: "subagent", agentId: agent.id })}
            >
              {agent.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

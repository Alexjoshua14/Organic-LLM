"use client";

import { useCallback, useMemo, useState } from "react";
import { SANDBOX_SCENARIO_REGISTRY } from "@/lib/sandbox/scenarios";
import type { SandboxScenarioRecord } from "@/lib/sandbox/scenarios";
import {
  DEFAULT_ENVIRONMENT,
  createFixtureEnvironment,
  createEphemeralEnvironment,
  type SandboxEnvironment,
} from "@/lib/sandbox/environment";
import { AdaptiveSandboxInput } from "./AdaptiveSandboxInput";
import { DebugTracePanel } from "./DebugTracePanel";
import { cn } from "@/lib/utils";

const SCENARIO_IDS = SANDBOX_SCENARIO_REGISTRY.map((s) => s.id);
const ENVIRONMENTS: { id: SandboxEnvironment["type"]; label: string }[] = [
  { id: "fixture", label: "Fixture" },
  { id: "ephemeral", label: "Ephemeral run" },
];

export function SandboxShell() {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(SCENARIO_IDS[0] ?? "");
  const [environment, setEnvironment] = useState<SandboxEnvironment>(DEFAULT_ENVIRONMENT);
  const [runState, setRunState] = useState<unknown>(null);
  const [lastInput, setLastInput] = useState<unknown>(null);
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(0);

  const activeScenario = useMemo(
    () => SANDBOX_SCENARIO_REGISTRY.find((s) => s.id === activeScenarioId) ?? null,
    [activeScenarioId]
  );

  const seedData = useMemo(
    () => (activeScenario ? activeScenario.getSeedData(environment) : null),
    [activeScenario, environment]
  );

  const trace = useMemo(() => {
    if (runState == null) return null;
    const r = runState as { trace?: { rawInput: unknown; modelOrFunction: string; latencyMs: number; error?: string; errorStack?: string; transformedPrompt?: string; intermediateOutputs?: Record<string, unknown>; normalizedProps?: unknown } };
    return r?.trace ?? null;
  }, [runState]);

  const debugExtra = useMemo(() => {
    if (!activeScenario?.getDebugData || lastInput == null || runState == null) return undefined;
    const raw = runState as { trace?: { latencyMs: number } };
    const timings = { latencyMs: raw?.trace?.latencyMs ?? 0 };
    const data = activeScenario.getDebugData(lastInput, runState, timings);
    const { trace: _t, ...rest } = data;
    return Object.keys(rest).length > 0 ? rest : undefined;
  }, [activeScenario, lastInput, runState]);

  const handleSubmit = useCallback(
    async (input: unknown) => {
      if (!activeScenario || seedData == null) return;
      setLastInput(input);
      try {
        const result = await activeScenario.run(input, seedData, environment);
        setRunState(result);
      } catch (err) {
        setRunState({
          trace: {
            rawInput: input,
            modelOrFunction: "scenario.run",
            latencyMs: 0,
            error: err instanceof Error ? err.message : String(err),
            errorStack: err instanceof Error ? err.stack : undefined,
          },
        });
      }
    },
    [activeScenario, seedData, environment]
  );

  const hybridOptions = useMemo(() => {
    if (!activeScenario || activeScenario.inputMode !== "hybrid" || seedData == null) return undefined;
    const seed = seedData as { articles?: { id: string; title: string; content: string }[] };
    const articles = seed.articles ?? [];
    if (articles.length === 0) return undefined;
    return {
      articles: [...articles],
      selectedIndex: selectedFixtureIndex,
      onSelectedIndexChange: setSelectedFixtureIndex,
      rootQuestion: undefined as string | undefined,
      pathHistory: undefined as string | undefined,
    };
  }, [activeScenario, seedData, selectedFixtureIndex]);

  const envStatusLabel = useMemo(() => {
    if (environment.type === "fixture" && environment.state && "label" in environment.state) {
      return (environment.state as { label?: string }).label ?? "Fixture";
    }
    if (environment.type === "ephemeral") return "Ephemeral run";
    return environment.type;
  }, [environment]);

  if (!activeScenario) {
    return (
      <div className="p-8 text-muted-foreground">
        No scenario selected. Registry may be empty.
      </div>
    );
  }

  const normalizedResult =
    runState != null && "trace" in (runState as object)
      ? activeScenario.normalize(runState)
      : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Scenario selector */}
      <header className="shrink-0 border-b border-border px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Scenario</label>
          <select
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            value={activeScenarioId}
            onChange={(e) => setActiveScenarioId(e.target.value)}
          >
            {SANDBOX_SCENARIO_REGISTRY.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Environment</label>
          <select
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            value={environment.type}
            onChange={(e) => {
              const t = e.target.value as SandboxEnvironment["type"];
              setEnvironment(
                t === "fixture"
                  ? createFixtureEnvironment("rabbit-holes", "Rabbit Holes fixtures")
                  : createEphemeralEnvironment()
              );
            }}
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env.id} value={env.id}>
                {env.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">{envStatusLabel}</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-md truncate" title={activeScenario.description}>
          {activeScenario.description}
        </p>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Center stage + input */}
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-auto">
          <section
            className={cn(
              "flex-1 flex flex-col items-center justify-start min-h-[200px]",
              "rounded-lg border border-border bg-muted/20 p-6"
            )}
          >
            {activeScenario.render({
              seedData,
              normalizedResult,
              runState: runState ?? undefined,
              lastInput: lastInput ?? undefined,
            })}
          </section>
          <section className="shrink-0 flex justify-center">
            <AdaptiveSandboxInput
              inputMode={activeScenario.inputMode}
              onSubmit={handleSubmit}
              placeholder={
                activeScenario.inputMode === "chat"
                  ? activeScenario.id === "rabbit-hole-refine"
                    ? "Enter a question to refine…"
                    : "Enter text or HTML for title…"
                  : undefined
              }
              buttonLabel="Generate"
              hybridOptions={hybridOptions}
            />
          </section>
        </div>

        {/* Debug panel + scenario actions */}
        <aside className="w-full lg:w-80 shrink-0 border-l border-border flex flex-col overflow-hidden">
          <div className="p-4 overflow-auto">
            <DebugTracePanel trace={trace} extra={debugExtra} />
          </div>
          {activeScenario.actions != null && activeScenario.actions.length > 0 && (
            <div className="p-4 border-t border-border">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Scenario actions
              </h3>
              <div className="flex flex-col gap-2">
                {activeScenario.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={cn(
                      "text-sm px-3 py-1.5 rounded-md",
                      action.kind === "destructive"
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-foreground hover:bg-muted"
                    )}
                    onClick={() => action.run(environment, seedData, runState)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

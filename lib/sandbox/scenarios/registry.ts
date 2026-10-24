import type { ReactNode } from "react";
import type { SandboxEnvironment } from "../environment";
import type { PipelineTrace } from "../pipelines/trace";

export type SandboxInputMode = "chat" | "form" | "button" | "hybrid";

export type ScenarioAction = {
  id: string;
  label: string;
  kind?: "default" | "destructive";
  run: (env: SandboxEnvironment, seedData: unknown, runState: unknown) => Promise<void>;
};

export interface SandboxScenario<TSeed = unknown, TInput = unknown, TRunResult = unknown> {
  id: string;
  namespace: string;
  label: string;
  description: string;
  inputMode: SandboxInputMode;
  environmentRequirements?: string[];
  getSeedData: (env: SandboxEnvironment) => TSeed;
  run: (input: TInput, seedData: TSeed, env: SandboxEnvironment) => Promise<TRunResult>;
  normalize: (rawRunResult: TRunResult) => unknown;
  render: (props: {
    seedData: TSeed;
    normalizedResult?: unknown;
    runState?: TRunResult;
    lastInput?: TInput;
  }) => ReactNode;
  getDebugData?: (
    input: TInput,
    rawRunResult: TRunResult,
    timings: { latencyMs: number }
  ) => { trace: PipelineTrace; [key: string]: unknown };
  actions?: ScenarioAction[];
}

export type SandboxScenarioRecord = SandboxScenario<unknown, unknown, unknown>;

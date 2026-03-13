import type { SandboxScenarioRecord } from "./registry";
import { rabbitHolesScenarios } from "./rabbit-holes";

export const SANDBOX_SCENARIO_REGISTRY: SandboxScenarioRecord[] = [
  ...rabbitHolesScenarios,
];

export type { SandboxScenarioRecord, SandboxScenario, SandboxInputMode } from "./registry";

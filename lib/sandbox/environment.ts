/**
 * Sandbox environment abstraction.
 * v1: fixture and ephemeral only; architecture allows test-user and mem0-sandbox later.
 */

export type SandboxEnvironmentType =
  | "fixture"
  | "ephemeral"
  | "test-user"
  | "mem0-sandbox";

export type FixtureState = {
  /** e.g. "rabbit-holes" – which fixture set is loaded */
  fixtureSet?: string;
  /** Optional label for UI (e.g. "3 articles") */
  label?: string;
};

export type EphemeralState = {
  /** Last run result + trace live here; no persistence */
  lastRunAt?: string;
};

/** Placeholder for future test-user env */
export type TestUserState = {
  userId?: string;
};

/** Placeholder for future Mem0 sandbox env */
export type Mem0SandboxState = {
  namespaceId?: string;
};

export type SandboxEnvironmentState =
  | FixtureState
  | EphemeralState
  | TestUserState
  | Mem0SandboxState;

export interface SandboxEnvironment {
  type: SandboxEnvironmentType;
  state: SandboxEnvironmentState;
}

export const DEFAULT_ENVIRONMENT: SandboxEnvironment = {
  type: "fixture",
  state: { fixtureSet: "rabbit-holes", label: "Rabbit Holes fixtures" },
};

export function createFixtureEnvironment(
  fixtureSet: string,
  label?: string
): SandboxEnvironment {
  return {
    type: "fixture",
    state: { fixtureSet, label: label ?? fixtureSet },
  };
}

export function createEphemeralEnvironment(): SandboxEnvironment {
  return {
    type: "ephemeral",
    state: {},
  };
}

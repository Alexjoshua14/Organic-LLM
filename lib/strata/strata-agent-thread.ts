import { v5 as uuidv5 } from "uuid";

/** Deterministic UUID namespace for Strata-scoped agent threads (not a random RFC variant). */
const STRATA_AGENT_THREAD_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

export type StrataAgentThreadScope =
  | { kind: "hub" }
  | { kind: "page"; pageId: string };

export function getStrataAgentThreadId(ownerId: string, scope: StrataAgentThreadScope): string {
  const material =
    scope.kind === "hub"
      ? `strata-agent:hub:${ownerId}`
      : `strata-agent:page:${ownerId}:${scope.pageId}`;

  return uuidv5(material, STRATA_AGENT_THREAD_NAMESPACE);
}

export function strataAgentThreadPath(scope: StrataAgentThreadScope): string {
  return scope.kind === "hub" ? "/sandbox/prototypes/strata" : `/sandbox/prototypes/strata/${scope.pageId}`;
}

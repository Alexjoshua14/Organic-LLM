import type { DmzQuarantineEntry } from "./types";

/** Per-user quarantine store — v1 in-memory; migrate to durable store with TTL. */
const quarantineByUser = new Map<string, DmzQuarantineEntry[]>();

export function getUserQuarantineRef(userId: string): DmzQuarantineEntry[] {
  let list = quarantineByUser.get(userId);

  if (!list) {
    list = [];
    quarantineByUser.set(userId, list);
  }

  return list;
}

export function resetQuarantineForTests(): void {
  quarantineByUser.clear();
}

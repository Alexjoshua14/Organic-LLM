import "server-only";

import { createHash } from "node:crypto";

import { JEV_STAGE_TURN_DEADLINE_MS } from "./constants";
import { emptyJevStageBundle, type JevStageBundle } from "./schema";

import {
  decryptFromStorage,
  encryptForStorage,
  isEncryptedPayload,
} from "@/lib/crypto/message-encryption";
import { redis } from "@/lib/redis/redis";

/**
 * Own Redis namespace for the Jev Stage prototype. Real Stage keys stay untouched.
 * Promotion later would point Stage at this shape or merge namespaces explicitly.
 */
function keys(ownerId: string) {
  const hash = createHash("sha256").update(ownerId).digest("hex");
  const prefix = `{jev-stage:${hash}}`;

  return {
    head: `${prefix}:head`,
    requests: `${prefix}:requests`,
    turnLease: `${prefix}:turn-lease`,
    designLease: `${prefix}:design-lease`,
  };
}

function decode(ownerId: string, value: string): JevStageBundle {
  if (!isEncryptedPayload(value)) throw new Error("Invalid jev-stage envelope");
  const plaintext = decryptFromStorage(value, {
    userId: ownerId,
    threadId: "jev-stage:head",
    fieldName: "jev-stage.bundle",
  });

  return JSON.parse(plaintext) as JevStageBundle;
}

function encode(ownerId: string, bundle: JevStageBundle) {
  return encryptForStorage(JSON.stringify(bundle), {
    userId: ownerId,
    threadId: "jev-stage:head",
    fieldName: "jev-stage.bundle",
  });
}

export async function readJevStage(ownerId: string): Promise<JevStageBundle> {
  const raw = (await redis.get<string>(keys(ownerId).head)) ?? "";

  return raw ? decode(ownerId, raw) : emptyJevStageBundle();
}

export async function writeJevStage(ownerId: string, bundle: JevStageBundle): Promise<void> {
  await redis.set(keys(ownerId).head, encode(ownerId, bundle));
}

export async function hasJevStageRequest(ownerId: string, requestId: string): Promise<boolean> {
  return (await redis.hget(keys(ownerId).requests, requestId)) != null;
}

export async function markJevStageRequest(ownerId: string, requestId: string): Promise<void> {
  await redis.hset(keys(ownerId).requests, { [requestId]: "1" });
}

type JevLeaseScope = "turn" | "design";

const TURN_LEASE_MS = JEV_STAGE_TURN_DEADLINE_MS + 30_000;
const DESIGN_LEASE_MS = 290_000;

function leaseKey(ownerId: string, scope: JevLeaseScope) {
  const pair = keys(ownerId);

  return scope === "design" ? pair.designLease : pair.turnLease;
}

export async function acquireJevStageLease(
  ownerId: string,
  scope: JevLeaseScope = "turn"
): Promise<string | null> {
  const token = crypto.randomUUID();
  const ok = await redis.set(leaseKey(ownerId, scope), token, {
    nx: true,
    px: scope === "design" ? DESIGN_LEASE_MS : TURN_LEASE_MS,
  });

  return ok === "OK" ? token : null;
}

export async function releaseJevStageLease(
  ownerId: string,
  token: string,
  scope: JevLeaseScope = "turn"
) {
  await redis.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
    [leaseKey(ownerId, scope)],
    [token]
  );
}

/** Serialize a brief background update with the prototype's conversational turn. */
export async function mutateJevStage(
  ownerId: string,
  update: (bundle: JevStageBundle) => JevStageBundle,
  signal?: AbortSignal
): Promise<JevStageBundle | null> {
  for (;;) {
    signal?.throwIfAborted();
    const lease = await acquireJevStageLease(ownerId);

    if (lease) {
      try {
        const current = await readJevStage(ownerId);
        const next = update(current);

        if (next !== current) await writeJevStage(ownerId, next);

        return next;
      } finally {
        await releaseJevStageLease(ownerId, lease);
      }
    }
    if (!signal) return null;
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
}

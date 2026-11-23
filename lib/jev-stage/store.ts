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
export function jevStageKeys(ownerId: string) {
  const hash = createHash("sha256").update(ownerId).digest("hex");
  const prefix = `{jev-stage:${hash}}`;

  return {
    prefix,
    active: `${prefix}:active`,
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
  const raw = (await redis.get<string>(jevStageKeys(ownerId).head)) ?? "";

  return raw ? decode(ownerId, raw) : emptyJevStageBundle();
}

export async function hasJevStageRequest(ownerId: string, requestId: string): Promise<boolean> {
  return (await redis.hget(jevStageKeys(ownerId).requests, requestId)) != null;
}

export async function finishJevStageRequest(
  ownerId: string,
  requestId: string,
  lease: string,
  admittedUntil: number,
  bundle: JevStageBundle
) {
  const { active, head, requests, turnLease } = jevStageKeys(ownerId);
  const saved = await redis.eval<unknown[], number>(
    `if redis.call('GET', KEYS[3]) ~= ARGV[3] then return 0 end
     if tonumber(redis.call('ZSCORE', KEYS[4], ARGV[2])) ~= tonumber(ARGV[4]) then return 0 end
     redis.call('SET', KEYS[1], ARGV[1])
     redis.call('HSET', KEYS[2], ARGV[2], '1')
     return 1`,
    [head, requests, turnLease, active],
    [encode(ownerId, bundle), requestId, lease, admittedUntil]
  );
  if (!saved) throw new Error("Jev Stage save lease expired");
}

export async function activeJevStageRequests(ownerId: string) {
  return redis.zrange<string[]>(jevStageKeys(ownerId).active, Date.now(), "+inf", { byScore: true });
}

/** Called inside the short state lease so reset and admissions cannot race. */
export async function beginJevStageRequest(ownerId: string, requestId: string, lease: string) {
  const { active, turnLease } = jevStageKeys(ownerId);
  const now = Date.now();

  return redis.eval<unknown[], number>(
    `if redis.call('GET', KEYS[2]) ~= ARGV[5] then return 0 end
     redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
     if redis.call('ZSCORE', KEYS[1], ARGV[3]) then return 0 end
     if redis.call('ZCARD', KEYS[1]) >= 4 then return 0 end
     redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
     redis.call('PEXPIRE', KEYS[1], ARGV[4])
     return tonumber(ARGV[2])`,
    [active, turnLease],
    [now, now + ACTIVE_REQUEST_TTL_MS, requestId, ACTIVE_REQUEST_TTL_MS, lease]
  );
}

export async function endJevStageRequest(ownerId: string, requestId: string, admittedUntil: number) {
  await redis.eval(
    `if tonumber(redis.call('ZSCORE', KEYS[1], ARGV[1])) == tonumber(ARGV[2])
       then return redis.call('ZREM', KEYS[1], ARGV[1]) end
     return 0`,
    [jevStageKeys(ownerId).active],
    [requestId, admittedUntil]
  );
}

type JevLeaseScope = "turn" | "design";

const ACTIVE_REQUEST_TTL_MS = JEV_STAGE_TURN_DEADLINE_MS + 30_000;
const STATE_LEASE_MS = 10_000;
const DESIGN_LEASE_MS = 290_000;

function leaseKey(ownerId: string, scope: JevLeaseScope) {
  const pair = jevStageKeys(ownerId);

  return scope === "design" ? pair.designLease : pair.turnLease;
}

export async function acquireJevStageLease(
  ownerId: string,
  scope: JevLeaseScope = "turn"
): Promise<string | null> {
  const token = crypto.randomUUID();
  const ok = await redis.set(leaseKey(ownerId, scope), token, {
    nx: true,
    px: scope === "design" ? DESIGN_LEASE_MS : STATE_LEASE_MS,
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

export async function waitForJevStageLease(ownerId: string, signal: AbortSignal) {
  for (;;) {
    signal.throwIfAborted();
    const lease = await acquireJevStageLease(ownerId);

    if (lease) return lease;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
}

/** Serialize a brief background update with the prototype's conversational turn. */
export async function mutateJevStage(
  ownerId: string,
  update: (bundle: JevStageBundle) => JevStageBundle | Promise<JevStageBundle>,
  signal?: AbortSignal
): Promise<JevStageBundle | null> {
  for (;;) {
    signal?.throwIfAborted();
    const lease = await acquireJevStageLease(ownerId);

    if (lease) {
      try {
        const current = await readJevStage(ownerId);
        const next = await update(current);

        if (next !== current) {
          const { head, turnLease } = jevStageKeys(ownerId);
          const saved = await redis.eval<unknown[], number>(
            `if redis.call('GET', KEYS[2]) ~= ARGV[2] then return 0 end
             redis.call('SET', KEYS[1], ARGV[1])
             return 1`,
            [head, turnLease],
            [encode(ownerId, next), lease]
          );

          if (!saved) throw new Error("Jev Stage save lease expired");
        }

        return next;
      } finally {
        await releaseJevStageLease(ownerId, lease);
      }
    }
    if (!signal) return null;
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
}

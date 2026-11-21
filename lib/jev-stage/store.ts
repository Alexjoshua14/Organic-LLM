import "server-only";

import { createHash } from "node:crypto";

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

const LEASE_MS = 120_000;

export async function acquireJevStageLease(ownerId: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const key = keys(ownerId).turnLease;
  const ok = await redis.set(key, token, { nx: true, px: LEASE_MS });

  return ok === "OK" ? token : null;
}

export async function releaseJevStageLease(ownerId: string, token: string): Promise<void> {
  const key = keys(ownerId).turnLease;
  const current = await redis.get<string>(key);

  if (current === token) await redis.del(key);
}

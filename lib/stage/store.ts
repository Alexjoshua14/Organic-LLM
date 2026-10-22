import "server-only";

import { createHash } from "node:crypto";

import { decryptFromStorage, encryptForStorage, isEncryptedPayload } from "@/lib/crypto/message-encryption";
import { redis } from "@/lib/redis/redis";
import { StageEventSchema, emptyStageState, type StageEvent, type StageState } from "./schema";

const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if (current or '') ~= ARGV[1] then return 0 end
if ARGV[3] ~= '' and redis.call('HEXISTS', KEYS[3], ARGV[3]) == 1 then return -1 end
if ARGV[4] ~= '' and redis.call('GET', KEYS[4]) ~= ARGV[4] then return -2 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('LPUSH', KEYS[2], ARGV[2])
if ARGV[3] ~= '' then redis.call('HSET', KEYS[3], ARGV[3], ARGV[5]) end
return 1
`;

function keys(ownerId: string) {
  const hash = createHash("sha256").update(ownerId).digest("hex");
  const prefix = `{stage:${hash}}`;
  return { head: `${prefix}:head`, events: `${prefix}:events`, requests: `${prefix}:requests`, turnLease: `${prefix}:turn-lease`, designLease: `${prefix}:design-lease` };
}

function decode(ownerId: string, value: string): StageEvent {
  const bar = value.indexOf("|");
  if (bar < 1) throw new Error("Invalid stage event envelope");
  const revision = Number(value.slice(0, bar));
  const ciphertext = value.slice(bar + 1);
  if (!Number.isSafeInteger(revision) || revision < 1 || !isEncryptedPayload(ciphertext)) {
    throw new Error("Invalid encrypted stage event");
  }
  const plaintext = decryptFromStorage(ciphertext, {
    userId: ownerId, threadId: `stage:${revision}`, fieldName: "stage.events",
  });
  const event = StageEventSchema.parse(JSON.parse(plaintext));
  if (event.revision !== revision || event.bundle.revision !== revision) {
    throw new Error("Stage revision integrity check failed");
  }
  return event;
}

function encode(ownerId: string, event: StageEvent) {
  const ciphertext = encryptForStorage(JSON.stringify(event), {
    userId: ownerId, threadId: `stage:${event.revision}`, fieldName: "stage.events",
  });
  return `${event.revision}|${ciphertext}`;
}

export async function readStage(ownerId: string): Promise<{ state: StageState; raw: string }> {
  const raw = (await redis.get<string>(keys(ownerId).head)) ?? "";
  return { state: raw ? decode(ownerId, raw).bundle : emptyStageState(), raw };
}

export type StageLease = { scope: "turn" | "design"; token: string };

export async function appendStageEvent(ownerId: string, expectedRaw: string, event: StageEvent, options: { deduplicate?: boolean; lease?: StageLease } = {}): Promise<boolean> {
  const pair = keys(ownerId);
  const leaseKey = options.lease?.scope === "design" ? pair.designLease : pair.turnLease;
  const actual = await redis.eval(CAS_SCRIPT, [pair.head, pair.events, pair.requests, leaseKey], [expectedRaw, encode(ownerId, event), options.deduplicate ? event.requestId ?? "" : "", options.lease?.token ?? "", String(event.revision)]);
  if (actual === -2) throw new Error("Stage generation lease expired");
  return actual === 1;
}

export async function mutateStage(
  ownerId: string,
  cause: StageEvent["cause"],
  mutate: (current: StageState) => StageState | null,
  options: { requestId?: string | null; usage?: StageEvent["usage"]; maxRetries?: number; deduplicate?: boolean; lease?: StageLease; call?: StageEvent["call"] } = {}
): Promise<StageState | null> {
  for (let attempt = 0; attempt < (options.maxRetries ?? 6); attempt++) {
    const { state, raw } = await readStage(ownerId);
    if (options.deduplicate && options.requestId && await hasStageRequest(ownerId, options.requestId)) return null;
    const changed = mutate(state);
    if (!changed) return null;
    const at = new Date().toISOString();
    const bundle = { ...changed, revision: state.revision + 1, updatedAt: at };
    const event = StageEventSchema.parse({
      revision: bundle.revision, at, cause,
      requestId: options.requestId ?? null,
      lastModel: bundle.lastModel, nextModel: bundle.nextModel,
      usage: options.usage ?? null, call: options.call ?? null, bundle,
    });
    if (await appendStageEvent(ownerId, raw, event, options)) return bundle;
  }
  throw new Error("Stage changed too often; please retry");
}

const PAGE_SCRIPT = `
local head = redis.call('GET', KEYS[1])
if not head then return {} end
local latest = tonumber(string.match(head, '^(%d+)|'))
if not latest then return {} end
local before = tonumber(ARGV[1])
local target = latest
if before and before > 0 then target = math.min(latest, before - 1) end
if target < 1 then return {} end
local start = latest - target
return redis.call('LRANGE', KEYS[2], start, start + tonumber(ARGV[2]) - 1)
`;

export async function listStageEvents(ownerId: string, before?: number, limit = 20) {
  const bounded = Math.max(1, Math.min(50, limit));
  const pair = keys(ownerId);
  // Read the head revision and matching list range in one Redis command; concurrent appends cannot shift the page.
  const raw = await redis.eval<string[], string[]>(PAGE_SCRIPT, [pair.head, pair.events], [String(before ?? 0), String(bounded)]);
  const events = raw.map((item) => decode(ownerId, item));
  const last = events.at(-1)?.revision;
  return { events, nextCursor: last && last > 1 ? last : null };
}

// This durable index is separate from the rolling message window. Its write shares the snapshot CAS.
export async function hasStageRequest(ownerId: string, requestId: string) {
  return Boolean(await redis.hexists(keys(ownerId).requests, requestId));
}

// Independent scopes let the central agent keep talking while the designer works.
export async function acquireStageLease(ownerId: string, scope: StageLease["scope"]): Promise<StageLease | null> {
  const token = crypto.randomUUID();
  const pair = keys(ownerId);
  const key = scope === "turn" ? pair.turnLease : pair.designLease;
  const result = await redis.set(key, token, { nx: true, px: scope === "turn" ? 120_000 : 80_000 });
  return result ? { scope, token } : null;
}

export async function releaseStageLease(ownerId: string, lease: StageLease) {
  const pair = keys(ownerId);
  const key = lease.scope === "turn" ? pair.turnLease : pair.designLease;
  await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", [key], [lease.token]);
}

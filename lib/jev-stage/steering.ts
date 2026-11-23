import "server-only";

import { experimental_createSteering } from "ai";

import { JEV_STAGE_TURN_DEADLINE_MS } from "./constants";
import type { JevStageCorrection } from "./schema";
import { jevStageKeys } from "./store";

import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { redis } from "@/lib/redis/redis";

const WORKER_TTL_MS = JEV_STAGE_TURN_DEADLINE_MS + 30_000;
const CORRECTION_POLL_MS = 500;
const MAX_CORRECTIONS_PER_HOP = 4;

type Worker = { turnId: string; hopId: string; goal: string };
type Correction = { id: string; text: string };
export type JevSteering = {
  sdk: ReturnType<typeof experimental_createSteering>;
  pull: () => Promise<void>;
};

const workerIndex = (ownerId: string) => `${jevStageKeys(ownerId).prefix}:workers`;
const workerKey = (ownerId: string, turnId: string) =>
  `${jevStageKeys(ownerId).prefix}:worker:${turnId}`;
const mailboxKey = (ownerId: string, hopId: string) =>
  `${jevStageKeys(ownerId).prefix}:mailbox:${hopId}`;
const statusKey = (ownerId: string, id: string) =>
  `${jevStageKeys(ownerId).prefix}:correction:${id}`;

function seal(ownerId: string, key: string, data: unknown) {
  return encryptForStorage(JSON.stringify(data), {
    userId: ownerId,
    threadId: key,
    fieldName: "jev-stage.steering",
  });
}

function open<T>(ownerId: string, key: string, data: string): T {
  return JSON.parse(
    decryptFromStorage(data, {
      userId: ownerId,
      threadId: key,
      fieldName: "jev-stage.steering",
    })
  ) as T;
}

export async function jevStageWorkers(ownerId: string): Promise<Worker[]> {
  const ids = await redis.zrange<string[]>(workerIndex(ownerId), Date.now(), "+inf", {
    byScore: true,
  });
  const keys = ids.map((id) => workerKey(ownerId, id));

  if (!keys.length) return [];
  const values = await redis.mget<(string | null)[]>(...keys);

  return values.flatMap((value, index) =>
    value ? [open<Worker>(ownerId, keys[index]!, value)] : []
  );
}

export async function submitJevCorrection(args: {
  ownerId: string;
  target: Worker;
  id: string;
  text: string;
  signal: AbortSignal;
  onQueued: (status: JevStageCorrection) => void;
}): Promise<JevStageCorrection> {
  const { ownerId, target, id, text, signal } = args;
  const worker = workerKey(ownerId, target.turnId);
  const mailbox = mailboxKey(ownerId, target.hopId);
  const status = statusKey(ownerId, id);
  const result = await redis.eval<unknown[], number>(
    `if redis.call('LLEN', KEYS[2]) >= tonumber(ARGV[2]) then return 0 end
     if not redis.call('GET', KEYS[1]) or redis.call('EXISTS', KEYS[4]) == 1 then return 0 end
     redis.call('RPUSH', KEYS[2], ARGV[1])
     redis.call('PEXPIRE', KEYS[2], ARGV[3])
     redis.call('SET', KEYS[3], 'queued', 'PX', ARGV[3])
     return 1`,
    [worker, mailbox, status, `${mailbox}:closed`],
    [seal(ownerId, mailbox, { id, text }), MAX_CORRECTIONS_PER_HOP, WORKER_TTL_MS]
  );
  const receipt = { targetTurnId: target.turnId, status: "queued" } as const;

  if (!result) return { ...receipt, status: "undelivered" };
  args.onQueued(receipt);
  while (!signal.aborted) {
    const [outcome, active] = await redis.mget<[string | null, string | null]>(status, worker);

    if (outcome === "delivered" || outcome === "undelivered") {
      return { ...receipt, status: outcome };
    }
    if (!outcome) return { ...receipt, status: "unconfirmed" };
    if (!active) return { ...receipt, status: "unconfirmed" };
    await new Promise<void>((resolve) => setTimeout(resolve, CORRECTION_POLL_MS));
  }
  return { ...receipt, status: "unconfirmed" };
}

export async function withJevStageSteering<T>(
  ownerId: string,
  turnId: string,
  goal: string,
  run: (steering: JevSteering) => Promise<T>
): Promise<T> {
  const hopId = crypto.randomUUID();
  const worker = workerKey(ownerId, turnId);
  const mailbox = mailboxKey(ownerId, hopId);
  const sdk = experimental_createSteering();
  const outcomes = new Map<string, Promise<unknown>>();
  const index = workerIndex(ownerId);
  const now = Date.now();
  await redis
    .multi()
    .set(worker, seal(ownerId, worker, { turnId, hopId, goal: goal.slice(0, 320) }), {
      px: WORKER_TTL_MS,
    })
    .zremrangebyscore(index, "-inf", now)
    .zadd(index, { score: now + WORKER_TTL_MS, member: turnId })
    .pexpire(index, WORKER_TTL_MS)
    .exec();

  const pull = async () => {
    const entries = await redis.lrange<string>(mailbox, 0, -1);

    for (const entry of entries) {
      const { id, text } = open<Correction>(ownerId, mailbox, entry);

      if (outcomes.has(id)) continue;
      const outcome = sdk.steer(text, { id }).then((result) =>
        redis.set(
          statusKey(ownerId, id),
          result.type === "delivered" ? "delivered" : "undelivered",
          {
            px: WORKER_TTL_MS,
          }
        )
      );

      // Observe failures even when the next Redis write is still in flight at stream completion.
      outcomes.set(
        id,
        outcome.catch(() => undefined)
      );
    }
  };

  const close = async () => {
    await redis.set(`${mailbox}:closed`, "1", { px: WORKER_TTL_MS });
    await Promise.all(outcomes.values());
    const entries = await redis.lrange<string>(mailbox, 0, -1);
    const transaction = redis.multi();

    for (const entry of entries) {
      const { id } = open<Correction>(ownerId, mailbox, entry);

      if (!outcomes.has(id)) {
        transaction.set(statusKey(ownerId, id), "undelivered", { px: WORKER_TTL_MS });
      }
    }
    await transaction.del(mailbox, worker).zrem(index, turnId).exec();
  };

  try {
    return await run({ sdk, pull });
  } finally {
    // A cleanup failure must not discard the worker's result. Redis keys also have a TTL.
    await close().catch(() => undefined);
  }
}

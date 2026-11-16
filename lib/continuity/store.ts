import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  ContinuityInteractionSchema,
  type ContinuityInteraction,
  type ContinuitySource,
} from "./schema";

import { redis } from "@/lib/redis/redis";
import {
  decryptFromStorage,
  encryptForStorage,
  isEncryptedPayload,
} from "@/lib/crypto/message-encryption";

export const CONTINUITY_TTL_SECONDS = 24 * 60 * 60;
const CAS = `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) return 1`;

export class ContinuityError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}
export type ContinuityStoreDeps = {
  get(key: string): Promise<string | null>;
  create(key: string, value: string, ttl: number): Promise<boolean>;
  cas(key: string, expected: string, next: string, ttl: number): Promise<boolean>;
  now(): number;
};
const defaults: ContinuityStoreDeps = {
  get: (key) => redis.get<string>(key),
  create: async (key, value, ttl) => (await redis.set(key, value, { nx: true, ex: ttl })) === "OK",
  cas: async (key, expected, next, ttl) =>
    (await redis.eval(CAS, [key], [expected, next, String(ttl)])) === 1,
  now: Date.now,
};

export function createContinuityStore(deps: ContinuityStoreDeps = defaults) {
  const key = (owner: string, id: string) =>
    `continuity:${createHash("sha256").update(owner).digest("hex")}:${id}`;
  const context = (owner: string, id: string) => ({
    userId: owner,
    threadId: `continuity:${id}:v1`,
    fieldName: "continuity.interaction" as const,
  });
  const encode = (owner: string, value: ContinuityInteraction) =>
    encryptForStorage(JSON.stringify(value), context(owner, value.interactionId));

  async function read(owner: string, id: string) {
    const raw = await deps.get(key(owner, id));

    if (!raw) throw new ContinuityError("Context selection expired. Please select it again.", 410);
    if (!isEncryptedPayload(raw)) throw new ContinuityError("Context selection unavailable", 410);
    const value = ContinuityInteractionSchema.parse(
      JSON.parse(decryptFromStorage(raw, context(owner, id)))
    );

    if (value.interactionId !== id || value.expiresAt <= deps.now())
      throw new ContinuityError("Context selection expired. Please select it again.", 410);

    return { raw, value };
  }

  return {
    async create(owner: string, surface: "speak" | "stage") {
      const value: ContinuityInteraction = {
        schemaVersion: 1,
        interactionId: randomUUID(),
        surface,
        revision: 0,
        selected: null,
        expiresAt: deps.now() + CONTINUITY_TTL_SECONDS * 1000,
        receipts: [],
      };

      if (
        !(await deps.create(
          key(owner, value.interactionId),
          encode(owner, value),
          CONTINUITY_TTL_SECONDS
        ))
      )
        throw new ContinuityError("Could not create context selection", 409);

      return value;
    },
    async get(owner: string, id: string) {
      const { raw, value } = await read(owner, id);
      const touched = { ...value, expiresAt: deps.now() + CONTINUITY_TTL_SECONDS * 1000 };

      // Refresh inactivity without overwriting a concurrent explicit selection. This read is
      // the turn's selection snapshot; a later selection applies to a later accepted turn.
      await deps.cas(key(owner, id), raw, encode(owner, touched), CONTINUITY_TTL_SECONDS);

      return value;
    },
    async select(
      owner: string,
      args: {
        interactionId: string;
        expectedRevision: number;
        requestId: string;
        source: ContinuitySource | null;
      },
      validate: (source: ContinuitySource) => Promise<void>
    ) {
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ expectedRevision: args.expectedRevision, source: args.source }))
        .digest("hex");

      for (let attempt = 0; attempt < 3; attempt++) {
        const { raw, value } = await read(owner, args.interactionId);

        // Replays still validate current eligibility, including deletion, before returning a receipt.
        if (args.source) await validate(args.source);
        const receipt = value.receipts.find((item) => item.requestId === args.requestId);

        if (receipt) {
          if (receipt.fingerprint !== fingerprint)
            throw new ContinuityError("Request id already used for another selection", 409);

          return {
            interactionId: value.interactionId,
            revision: receipt.revision,
            selected: receipt.selected,
          };
        }
        if (value.revision !== args.expectedRevision)
          throw new ContinuityError("Context selection changed. Refresh and try again.", 409);
        const revision = value.revision + 1;
        const selected = args.source;
        const next = {
          ...value,
          revision,
          selected,
          expiresAt: deps.now() + CONTINUITY_TTL_SECONDS * 1000,
          receipts: [
            ...value.receipts,
            { requestId: args.requestId, fingerprint, revision, selected },
          ].slice(-64),
        };

        if (
          await deps.cas(
            key(owner, value.interactionId),
            raw,
            encode(owner, next),
            CONTINUITY_TTL_SECONDS
          )
        )
          return { interactionId: value.interactionId, revision, selected };
      }
      throw new ContinuityError("Context selection changed. Try again.", 409);
    },
  };
}
export const continuityStore = createContinuityStore();

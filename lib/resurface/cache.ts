import "server-only";

import type { EncryptionContext } from "@/lib/crypto/message-encryption";
import type { RankedResurfaceCard } from "@/lib/resurface/rank";
import type { ResurfaceCard } from "@/lib/resurface/schema";

import { randomUUID } from "crypto";

import { z } from "zod";

import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { createLogger } from "@/lib/logger";
import { redis } from "@/lib/redis/redis";
import { RESURFACE_KINDS } from "@/lib/resurface/schema";

const logger = createLogger("lib/resurface/cache.ts");

/**
 * Two keys per owner, both encrypted with the message-storage helpers — they hold decrypted
 * thread summaries and memory text, which must not sit in Redis as plaintext.
 *
 * - The **list** is what the homepage shows. A Jev ranking holds for
 *   {@link RESURFACE_LIST_TTL_SECONDS}; a recency fallback for only
 *   {@link RESURFACE_FALLBACK_TTL_SECONDS}, so a transient Jev failure does not stick.
 * - Each **card** outlives the list by hours, so a homepage left open past the list's expiry can
 *   still start a call from the card it is showing.
 */
export const RESURFACE_LIST_TTL_SECONDS = 30 * 60;
export const RESURFACE_FALLBACK_TTL_SECONDS = 3 * 60;
export const RESURFACE_CARD_TTL_SECONDS = 12 * 60 * 60;

/** Synthetic thread id for the encryption context; not a real chat thread. */
const RESURFACE_CACHE_THREAD_ID = "homepage-resurface-cache";

const KindSchema = z.enum(RESURFACE_KINDS);

const CandidateSnapshotSchema = z.object({
  kind: KindSchema,
  title: z.string(),
  text: z.string(),
});

const CardRecordSchema = z.object({
  id: z.string(),
  kind: KindSchema,
  title: z.string(),
  recap: z.string(),
  href: z.string().nullable(),
  sourceText: z.string(),
  related: z.array(CandidateSnapshotSchema),
});

/** A card as cached: everything the Speak mint needs to seed a call, without re-reading sources. */
export type ResurfaceCardRecord = z.infer<typeof CardRecordSchema>;

const ListRecordSchema = z.object({
  cards: z.array(CardRecordSchema),
  source: z.enum(["jev", "fallback"]),
  createdAt: z.number(),
});

export type ResurfaceListRecord = z.infer<typeof ListRecordSchema>;

/** The slice of the Redis client this module uses; tests pass an in-memory stand-in. */
export type ResurfaceCacheStore = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
};

const redisStore: ResurfaceCacheStore = {
  get: (key) => redis.get(key),
  set: (key, value, ttlSeconds) => redis.set(key, value, { ex: ttlSeconds }),
};

function listKey(ownerId: string): string {
  return `resurface:v1:list:${ownerId}`;
}

function cardKey(ownerId: string, cardId: string): string {
  return `resurface:v1:card:${ownerId}:${cardId}`;
}

function encryptionContext(ownerId: string): EncryptionContext {
  return {
    userId: ownerId,
    threadId: RESURFACE_CACHE_THREAD_ID,
    fieldName: "homepage.cache.resurface",
  };
}

function seal(ownerId: string, value: unknown): string {
  return encryptForStorage(JSON.stringify(value), encryptionContext(ownerId));
}

function unseal<T>(ownerId: string, raw: unknown, schema: z.ZodType<T>): T | null {
  if (typeof raw !== "string" || !raw) return null;

  try {
    const parsed = schema.safeParse(
      JSON.parse(decryptFromStorage(raw, encryptionContext(ownerId)))
    );

    return parsed.success ? parsed.data : null;
  } catch {
    logger.warn("unseal", "Unreadable resurface cache entry; treating as a miss");

    return null;
  }
}

export function toCardRecords(cards: RankedResurfaceCard[]): ResurfaceCardRecord[] {
  return cards.map((card) => ({
    id: randomUUID(),
    kind: card.candidate.kind,
    title: card.title,
    recap: card.recap,
    href: card.candidate.href,
    sourceText: card.candidate.text,
    related: card.related.map((r) => ({ kind: r.kind, title: r.title, text: r.text })),
  }));
}

export function toPublicCards(records: ResurfaceCardRecord[]): ResurfaceCard[] {
  return records.map(({ id, kind, title, href }) => ({ id, kind, title, href }));
}

export async function readResurfaceList(
  ownerId: string,
  store: ResurfaceCacheStore = redisStore
): Promise<ResurfaceListRecord | null> {
  try {
    return unseal(ownerId, await store.get(listKey(ownerId)), ListRecordSchema);
  } catch {
    return null;
  }
}

export async function writeResurfaceList(
  ownerId: string,
  list: ResurfaceListRecord,
  store: ResurfaceCacheStore = redisStore
): Promise<void> {
  const listTtl =
    list.source === "jev" ? RESURFACE_LIST_TTL_SECONDS : RESURFACE_FALLBACK_TTL_SECONDS;

  try {
    await Promise.all([
      store.set(listKey(ownerId), seal(ownerId, list), listTtl),
      ...list.cards.map((card) =>
        store.set(cardKey(ownerId, card.id), seal(ownerId, card), RESURFACE_CARD_TTL_SECONDS)
      ),
    ]);
  } catch (error) {
    // The homepage still renders what it computed; only the next load pays again.
    logger.warn(
      "writeResurfaceList",
      `Cache write failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/** The card a Speak mint was asked to seed from, or null when it expired or was never this owner's. */
export async function findResurfaceCard(
  ownerId: string,
  cardId: string,
  store: ResurfaceCacheStore = redisStore
): Promise<ResurfaceCardRecord | null> {
  try {
    return unseal(ownerId, await store.get(cardKey(ownerId, cardId)), CardRecordSchema);
  } catch {
    return null;
  }
}

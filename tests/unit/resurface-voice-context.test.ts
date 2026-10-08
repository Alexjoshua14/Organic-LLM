import type { ResurfaceCacheStore, ResurfaceCardRecord } from "@/lib/resurface/cache";
import type { ResurfaceVoiceSeed } from "@/lib/resurface/voice-context";

import { beforeAll, describe, expect, test } from "bun:test";

import {
  findResurfaceCard,
  readResurfaceList,
  RESURFACE_CARD_TTL_SECONDS,
  RESURFACE_FALLBACK_TTL_SECONDS,
  RESURFACE_LIST_TTL_SECONDS,
  toPublicCards,
  writeResurfaceList,
} from "@/lib/resurface/cache";
import { ResurfaceSeedSchema } from "@/lib/resurface/schema";
import {
  formatResurfaceVoiceContext,
  RESURFACE_OPENING_DIRECTIVE,
} from "@/lib/resurface/voice-context";
import { loadResurfaceVoiceSeed } from "@/lib/resurface/voice-seed";
import { buildSpeakRealtimeInstructions } from "@/lib/system-prompt/speak-realtime";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";

beforeAll(() => {
  process.env.ORGANIC_LLM_ROOT_SECRET ??= "test-root-secret";
  process.env.ORGANIC_LLM_ACTIVE_KEY_ID ??= "k1";
});

const CARD: ResurfaceCardRecord = {
  id: "card-1",
  kind: "thread",
  title: "Lisbon trip plan",
  recap: "You were choosing between two neighbourhoods for the October trip.",
  href: "/chat/t1",
  sourceText: "Planning a Lisbon trip; torn between Alfama and Príncipe Real.",
  related: [{ kind: "memory", title: "Prefers walkable areas", text: "Prefers walkable areas" }],
};

function seed(overrides: Partial<ResurfaceVoiceSeed> = {}): ResurfaceVoiceSeed {
  return {
    kind: CARD.kind,
    title: CARD.title,
    recap: CARD.recap,
    sourceText: CARD.sourceText,
    related: CARD.related,
    memories: [],
    ...overrides,
  };
}

function memoryStore(): ResurfaceCacheStore & {
  ttl: Map<string, number>;
  raw: Map<string, string>;
} {
  const raw = new Map<string, string>();
  const ttl = new Map<string, number>();

  return {
    raw,
    ttl,
    async get(key) {
      return raw.get(key) ?? null;
    },
    async set(key, value, ttlSeconds) {
      raw.set(key, value);
      ttl.set(key, ttlSeconds);
    },
  };
}

describe("formatResurfaceVoiceContext", () => {
  test("opens with the speak-first recap directive, then the thought and its related items", () => {
    const text = formatResurfaceVoiceContext(seed());

    expect(text.startsWith(RESURFACE_OPENING_DIRECTIVE)).toBe(true);
    expect(text).toContain("You speak first.");
    expect(text).toContain("Resurfaced thought (Chat): Lisbon trip plan");
    expect(text).toContain(`Recap: ${CARD.recap}`);
    expect(text).toContain(`In their words: ${CARD.sourceText}`);
    expect(text).toContain('- Memory "Prefers walkable areas": Prefers walkable areas');
  });

  test("memories appear only when given, and are the first thing dropped to fit", () => {
    const memories = Array.from({ length: 30 }, (_, i) => `Memory ${i} ${"m".repeat(200)}`);
    const roomy = formatResurfaceVoiceContext(seed({ memories: memories.slice(0, 2) }));
    const tight = formatResurfaceVoiceContext(seed({ memories }), 400);

    expect(roomy).toContain("What you remember about them");
    expect(tight).toContain("Resurfaced thought (Chat)");
    expect(tight).not.toContain("Memory 29");
  });

  test("in instructions, the resurface block stands in for the resumed-thread preamble", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, {
      resumed: false,
      resurfaceContext: formatResurfaceVoiceContext(seed()),
    });

    expect(text).toContain("You speak first.");
    expect(text).not.toContain("do not recap");
    expect(text).not.toContain("continuing an earlier conversation");
  });
});

describe("loadResurfaceVoiceSeed", () => {
  test("searches memory only when the session opted in, and skips the source's own text", async () => {
    let searches = 0;
    const searchMemories = (async () => {
      searches++;

      return {
        data: {
          results: [
            { id: "m1", memory: CARD.sourceText },
            { id: "m2", memory: "Hates hills" },
          ],
        },
        error: null,
      };
    }) as never;

    const off = await loadResurfaceVoiceSeed(
      { ownerId: "owner-1", card: CARD, memoryEnabled: false },
      { searchMemories }
    );
    const on = await loadResurfaceVoiceSeed(
      { ownerId: "owner-1", card: CARD, memoryEnabled: true },
      { searchMemories }
    );

    expect(off.memories).toEqual([]);
    expect(on.memories).toEqual(["Hates hills"]);
    expect(searches).toBe(1);
  });

  test("a failed search seeds the call without memories", async () => {
    const seeded = await loadResurfaceVoiceSeed(
      { ownerId: "owner-1", card: CARD, memoryEnabled: true },
      {
        searchMemories: (async () => {
          throw new Error("Mem0 down");
        }) as never,
      }
    );

    expect(seeded.memories).toEqual([]);
    expect(seeded.title).toBe(CARD.title);
  });
});

describe("resurface cache", () => {
  test("cards round-trip encrypted, and only their owner can find them", async () => {
    const store = memoryStore();

    await writeResurfaceList("owner-1", { cards: [CARD], source: "jev", createdAt: 1 }, store);

    expect([...store.raw.values()].every((v) => v.startsWith("enc:"))).toBe(true);
    expect([...store.raw.values()].some((v) => v.includes("Lisbon"))).toBe(false);
    expect((await readResurfaceList("owner-1", store))?.cards).toEqual([CARD]);
    expect(await findResurfaceCard("owner-1", "card-1", store)).toEqual(CARD);
    expect(await findResurfaceCard("owner-2", "card-1", store)).toBeNull();
  });

  test("a fallback list expires sooner than a Jev ranking; cards outlive both", async () => {
    const jev = memoryStore();
    const fallback = memoryStore();

    await writeResurfaceList("owner-1", { cards: [CARD], source: "jev", createdAt: 1 }, jev);
    await writeResurfaceList(
      "owner-1",
      { cards: [CARD], source: "fallback", createdAt: 1 },
      fallback
    );

    expect(jev.ttl.get("resurface:v1:list:owner-1")).toBe(RESURFACE_LIST_TTL_SECONDS);
    expect(fallback.ttl.get("resurface:v1:list:owner-1")).toBe(RESURFACE_FALLBACK_TTL_SECONDS);
    expect(jev.ttl.get("resurface:v1:card:owner-1:card-1")).toBe(RESURFACE_CARD_TTL_SECONDS);
  });

  test("the client sees id, kind, title and link — never the recap or context", () => {
    expect(toPublicCards([CARD])).toEqual([
      { id: "card-1", kind: "thread", title: "Lisbon trip plan", href: "/chat/t1" },
    ]);
  });

  test("the mint seed carries a card id and nothing else", () => {
    expect(ResurfaceSeedSchema.safeParse({ cardId: "card-1" }).success).toBe(true);
    expect(ResurfaceSeedSchema.safeParse({ cardId: "" }).success).toBe(false);
    expect(ResurfaceSeedSchema.parse({ cardId: "card-1", title: "injected" })).toEqual({
      cardId: "card-1",
    });
  });
});

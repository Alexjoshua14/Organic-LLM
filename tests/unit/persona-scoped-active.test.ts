import { describe, expect, test } from "bun:test";

import { createPersonaStore, type PersonaRedis } from "@/lib/personas/unified/store";
import { chatPersonaScope, SPEAK_PERSONA_SCOPE } from "@/lib/personas/unified/session";

/** Minimal Redis stand-in: string keys, list keys, and TTL ignored. */
function memoryRedis(): PersonaRedis {
  const strings = new Map<string, string>();
  const lists = new Map<string, string[]>();

  return {
    async get<T = unknown>(key: string) {
      return (strings.get(key) as T | undefined) ?? null;
    },
    async set(key: string, value: string) {
      strings.set(key, value);
    },
    async del(...keys: string[]) {
      for (const key of keys) {
        strings.delete(key);
        lists.delete(key);
      }
    },
    async lpush(key: string, ...values: string[]) {
      const list = lists.get(key) ?? [];

      list.unshift(...values);
      lists.set(key, list);
    },
    async ltrim(key: string, start: number, stop: number) {
      const list = lists.get(key) ?? [];

      lists.set(key, list.slice(start, stop + 1));
    },
    async lrange<T = unknown>(key: string, start: number, stop: number) {
      const list = lists.get(key) ?? [];

      return list.slice(start, stop + 1) as T[];
    },
    async expire() {
      return 1;
    },
  };
}

const passthroughCrypto = {
  encrypt: (plaintext: string) => plaintext,
  decrypt: (ciphertext: string) => ciphertext,
};

describe("persona store scoped active", () => {
  test("enable in chat A does not activate chat B or Speak", async () => {
    const store = createPersonaStore({
      redis: memoryRedis(),
      crypto: passthroughCrypto,
      now: () => new Date("2026-10-01T12:00:00.000Z"),
      uuid: () => "11111111-1111-4111-8111-111111111111",
    });
    const owner = "owner-1";
    const chatA = chatPersonaScope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const chatB = chatPersonaScope("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const session = await store.create(owner, chatA, {
      personaId: "artist-assistant",
      subject: "eclipse study",
    });

    expect(await store.active(owner, chatA)).toMatchObject({ id: session.id });
    expect(await store.active(owner, chatB)).toBeNull();
    expect(await store.active(owner, SPEAK_PERSONA_SCOPE)).toBeNull();
  });

  test("disable clears only the scoped active pointer and keeps latest for resume", async () => {
    const store = createPersonaStore({
      redis: memoryRedis(),
      crypto: passthroughCrypto,
      now: () => new Date("2026-10-01T12:00:00.000Z"),
      uuid: () => "22222222-2222-4222-8222-222222222222",
    });
    const owner = "owner-2";
    const chatA = chatPersonaScope("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

    const session = await store.create(owner, chatA, { personaId: "artist-assistant" });

    expect(await store.activate(owner, chatA, null)).toBe(true);
    expect(await store.active(owner, chatA)).toBeNull();
    expect(await store.latest(owner)).toMatchObject({ id: session.id });

    expect(await store.activate(owner, chatA, session.id)).toBe(true);
    expect(await store.active(owner, chatA)).toMatchObject({ id: session.id });
  });

  test("activate(null) drops the legacy global active key", async () => {
    const redis = memoryRedis();
    const store = createPersonaStore({
      redis,
      crypto: passthroughCrypto,
      now: () => new Date("2026-10-01T12:00:00.000Z"),
      uuid: () => "33333333-3333-4333-8333-333333333333",
    });
    const owner = "owner-3";
    const chatA = chatPersonaScope("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const legacyKey = `persona:v1:active:${owner}`;

    await redis.set(legacyKey, "33333333-3333-4333-8333-333333333333");
    await store.create(owner, chatA, { personaId: "artist-assistant" });
    await store.activate(owner, chatA, null);

    expect(await redis.get(legacyKey)).toBeNull();
    expect(await store.active(owner, chatA)).toBeNull();
  });
});

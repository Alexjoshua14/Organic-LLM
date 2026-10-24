import type { CoreInputSettings } from "@/lib/core-input/settings";

import { describe, expect, test } from "bun:test";

import {
  cyrb53,
  decodeSnapshot,
  encodeSnapshot,
  hashScopeKey,
  modelCode,
  packSnapshotEntries,
  SNAPSHOT_ENTRY_BYTES,
  unpackSnapshotEntries,
} from "@/lib/core-input/snapshot-codec";
import { SNAPSHOT_CACHE_CAPACITY } from "@/lib/core-input/snapshot-store";
import { CONTEXT_EFFORT_LEVELS } from "@/lib/memory/context-effort";
import { CHAT_EFFORT_LEVELS } from "@/lib/schemas/chat-effort";
import { ChatModels } from "@/lib/schemas/chat";

const base: CoreInputSettings = {
  modelId: ChatModels[1]!.id,
  effort: "high",
  contextEffort: "heavy",
  webSearch: true,
  memories: false,
  speechFriendly: true,
};

describe("core input snapshot codec", () => {
  test("every model, effort, and context effort round-trips", () => {
    for (const model of ChatModels) {
      for (const effort of CHAT_EFFORT_LEVELS) {
        for (const contextEffort of CONTEXT_EFFORT_LEVELS) {
          const settings = { ...base, modelId: model.id, effort: effort.id, contextEffort };

          expect(decodeSnapshot(encodeSnapshot(settings))).toEqual(settings);
        }
      }
    }
  });

  test("toggles occupy independent bits", () => {
    for (const webSearch of [true, false]) {
      for (const memories of [true, false]) {
        for (const speechFriendly of [true, false]) {
          const settings = { ...base, webSearch, memories, speechFriendly };

          expect(decodeSnapshot(encodeSnapshot(settings))).toEqual(settings);
        }
      }
    }
  });

  test("model codes are unique across the registry", () => {
    const codes = new Set(ChatModels.map((model) => modelCode(model.id)));

    expect(codes.size).toBe(ChatModels.length);
  });

  test("values stay exact in JSON, Postgres bigint, and float64", () => {
    for (const model of ChatModels) {
      const value = encodeSnapshot({ ...base, modelId: model.id });

      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeLessThan(2 ** 37);
      expect(JSON.parse(JSON.stringify(value))).toBe(value);
    }
    expect(Number.isSafeInteger(hashScopeKey("arcadia:thread:abc"))).toBe(true);
  });

  test("a model dropped from the registry decodes as null, not as another model", () => {
    const value = encodeSnapshot({ ...base, modelId: "retired/model-that-no-longer-exists" });

    expect(decodeSnapshot(value)?.modelId).toBeNull();
    expect(decodeSnapshot(value)?.effort).toBe("high");
  });

  test("empty, foreign-version, and malformed values decode as absent", () => {
    const value = encodeSnapshot(base);

    expect(decodeSnapshot(0)).toBeNull();
    expect(decodeSnapshot(-1)).toBeNull();
    expect(decodeSnapshot(1.5)).toBeNull();
    // Version lives in the low nibble; any other version is unreadable by this layout.
    expect(decodeSnapshot(value - 1 + 2)).toBeNull();
  });

  test("scope hashes are seeded apart from model codes and spread across keys", () => {
    const hashes = new Set(
      Array.from({ length: SNAPSHOT_CACHE_CAPACITY }, (_, i) => hashScopeKey(`arcadia:thread:${i}`))
    );

    expect(hashes.size).toBe(SNAPSHOT_CACHE_CAPACITY);
    expect(cyrb53("aion")).not.toBe(cyrb53("aion", 1));
  });

  test("a full cache packs to 128 bits per entry and unpacks exactly", () => {
    const entries = Array.from({ length: SNAPSHOT_CACHE_CAPACITY }, (_, i) => [
      hashScopeKey(`scope:${i}`),
      encodeSnapshot({ ...base, webSearch: i % 2 === 0 }),
    ]) as Array<[number, number]>;
    const packed = packSnapshotEntries(entries);

    expect(SNAPSHOT_ENTRY_BYTES * 8).toBe(128);
    expect(atob(packed).length).toBe(SNAPSHOT_CACHE_CAPACITY * SNAPSHOT_ENTRY_BYTES);
    expect(unpackSnapshotEntries(packed)).toEqual(entries);
  });

  test("corrupt packed input yields no entries", () => {
    expect(unpackSnapshotEntries("not base64 !!")).toEqual([]);
    expect(unpackSnapshotEntries(btoa("short"))).toEqual([]);
  });
});

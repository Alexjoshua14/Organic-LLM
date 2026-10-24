import type { CoreInputSettings } from "@/lib/core-input/settings";

import { describe, expect, test } from "bun:test";

import {
  readLegacyComposerPrefs,
  writeLegacyComposerPrefs,
} from "@/lib/core-input/legacy-prefs";
import { encodeSnapshot } from "@/lib/core-input/snapshot-codec";
import { CoreInputSnapshotStore } from "@/lib/core-input/snapshot-store";
import { createSnapshotSync } from "@/lib/core-input/snapshot-sync";
import { ChatModels } from "@/lib/schemas/chat";

const settings: CoreInputSettings = {
  modelId: ChatModels[1]!.id,
  effort: "low",
  contextEffort: "instant",
  webSearch: false,
  memories: true,
  speechFriendly: true,
};

function storage() {
  const data = new Map<string, string>();

  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function setup(responses: Array<{ status: number; body?: unknown }>) {
  const local = storage();
  const store = new CoreInputSnapshotStore({
    storage: () => local,
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const sync = createSnapshotSync({
    store,
    fetch: async (url, init) => {
      requests.push({ url, init });
      const next = responses.shift() ?? { status: 200, body: {} };

      return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
  });

  return { store, sync, requests };
}

describe("core input snapshot sync", () => {
  test("pull merges server rows into the cache", async () => {
    const { store, sync } = setup([
      {
        status: 200,
        body: { rows: [{ scopeKey: "aion", value: encodeSnapshot(settings), updatedAt: 10 }] },
      },
    ]);

    await sync.pull();
    expect(store.read("aion")?.effort).toBe("low");
  });

  test("push sends pending rows and clears them once accepted", async () => {
    const { store, sync, requests } = setup([{ status: 200, body: { accepted: [] } }]);

    store.write("aion", settings);
    await sync.push();

    expect(JSON.parse(String(requests[0]!.init!.body)).rows[0].scopeKey).toBe("aion");
    expect(store.pendingRows()).toEqual([]);
  });

  test("a missing table turns sync off and keeps local writes pending", async () => {
    const { store, sync, requests } = setup([{ status: 503 }]);

    store.write("aion", settings);
    await sync.push();
    await sync.push();

    expect(requests).toHaveLength(1);
    expect(store.pendingRows()).toHaveLength(1);
  });
});

describe("legacy composer prefs", () => {
  const keys = { model: "m", effort: "e", memories: "mem" };
  const defaults: CoreInputSettings = { ...settings, modelId: ChatModels[0]!.id, effort: "auto" };

  test("round-trips and refreshes the timestamp on read", () => {
    const store = storage();

    writeLegacyComposerPrefs(store, keys, settings, 1_000);
    expect(readLegacyComposerPrefs(store, keys, defaults, 2_000)).toEqual({
      ...settings,
      contextEffort: defaults.contextEffort,
    });
    expect(store.data.get("organic-llm-prefs-timestamp")).toBe("2000");
  });

  test("expires after a day without a visit", () => {
    const store = storage();

    writeLegacyComposerPrefs(store, keys, settings, 0);
    expect(readLegacyComposerPrefs(store, keys, defaults, 25 * 60 * 60 * 1000)).toEqual(defaults);
    expect(store.data.size).toBe(0);
  });
});

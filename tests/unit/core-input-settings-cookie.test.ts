import type { CoreInputSettings } from "@/lib/core-input/settings";

import { describe, expect, test } from "bun:test";

import { coreInputScopes } from "@/lib/core-input/scopes";
import { encodeSnapshot, hashScopeKey } from "@/lib/core-input/snapshot-codec";
import { CoreInputSnapshotStore } from "@/lib/core-input/snapshot-store";
import {
  decodeSettingsCookie,
  encodeSettingsCookie,
  resolveCookieSettings,
  selectCookieEntries,
  writeSettingsCookie,
  CORE_INPUT_COOKIE_NAME,
} from "@/lib/core-input/settings-cookie";
import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";

const settings: CoreInputSettings = {
  modelId: DEFAULT_COMPOSER_MODEL.id,
  effort: "auto",
  contextEffort: "quick",
  webSearch: false,
  memories: true,
  speechFriendly: true,
};
const flags = { experimentalContextEffort: true, experimentalArcadiaMarkdownPreview: true };
const row = (key: string, value = settings): [number, number] => [
  hashScopeKey(key),
  encodeSnapshot(value),
];

describe("CoreInput settings cookie", () => {
  test("round-trips settings and flags, resolves the thread before its area", () => {
    const scope = coreInputScopes.thread("arcadia", "one");
    const cookie = decodeSettingsCookie(
      encodeSettingsCookie({
        ...flags,
        entries: [row("arcadia", { ...settings, webSearch: true }), row(scope.key)],
      })
    );

    expect(resolveCookieSettings(cookie, scope)).toEqual({
      ...flags,
      scopeKey: scope.key,
      settings,
    });
    expect(
      resolveCookieSettings(cookie, coreInputScopes.thread("arcadia", "other"))?.settings.webSearch
    ).toBe(true);
    expect(resolveCookieSettings(cookie, coreInputScopes.area("chat"))).toBeNull();
    expect(resolveCookieSettings(cookie, coreInputScopes.btw("arcadia", "one"))).toBeNull();
  });

  test("retains all four areas and only the eight most recently used other scopes", () => {
    const areas = ["chat", "arcadia", "aion", "rabbit-holes"].map((key) => row(key));
    const threads = Array.from({ length: 30 }, (_, i) => row(`arcadia:thread:${i}`));
    const selected = selectCookieEntries([...areas, ...threads]);

    expect(selected).toEqual([...areas, ...threads.slice(-8)]);
    const encoded = encodeSettingsCookie({ ...flags, entries: selected });

    expect(encoded.length).toBeLessThan(300);
    expect(decodeSettingsCookie(encoded)?.entries).toHaveLength(12);
  });

  test("rejects corrupt, oversized, unknown-version and unknown-model hints", () => {
    const valid = encodeSettingsCookie({ ...flags, entries: [row("chat")] });
    const unknown = encodeSettingsCookie({
      ...flags,
      entries: [row("chat", { ...settings, modelId: "removed-model" })],
    });

    for (const raw of [
      undefined,
      "",
      "x".repeat(513),
      valid.replace(/^1/, "2"),
      "1_4",
      "1_0_1.1!",
      "1_0_1.0",
      "1_0_zzzzzzzzzzz.1",
      unknown,
      `${valid}_${valid.split("_")[2]}`,
    ]) {
      expect(decodeSettingsCookie(raw)).toBeNull();
    }
  });

  test("store mirrors visits and changes immediately, excludes ephemeral edits", () => {
    const mirrored: Array<Array<[number, number]>> = [];
    const store = new CoreInputSnapshotStore({
      storage: () => ({ getItem: () => null, setItem: () => {} }),
      onMirror: (entries) => mirrored.push(entries),
      setTimeout: () => 1,
    });
    const first = coreInputScopes.thread("arcadia", "one");
    const second = coreInputScopes.thread("arcadia", "two");

    store.commit(first, settings);
    store.commit(second, settings);
    store.read(first.key);
    expect(mirrored.at(-1)?.at(-1)?.[0]).toBe(hashScopeKey(first.key));
    const calls = mirrored.length;

    store.commit(coreInputScopes.btw("arcadia", "one"), { ...settings, webSearch: true });
    expect(mirrored).toHaveLength(calls);
    store.mergeRemote([{ scopeKey: "chat", value: encodeSnapshot(settings), updatedAt: 123 }]);
    expect(mirrored.at(-1)?.at(-1)).toEqual(row("chat"));
  });

  test("browser writes merge flags and snapshots without persisting content", () => {
    document.cookie = `${CORE_INPUT_COOKIE_NAME}=; Max-Age=0; Path=/`;
    try {
      writeSettingsCookie(flags);
      writeSettingsCookie({ entries: [row("chat")] });
      const raw = document.cookie
        .split("; ")
        .find((value) => value.startsWith(`${CORE_INPUT_COOKIE_NAME}=`))
        ?.split("=")[1];

      expect(decodeSettingsCookie(raw)).toEqual({ ...flags, entries: [row("chat")] });
    } finally {
      document.cookie = `${CORE_INPUT_COOKIE_NAME}=; Max-Age=0; Path=/`;
    }
  });
});

import { describe, expect, test } from "bun:test";

import {
  canCacheErgonSnapshot,
  ergonOfflineAllows,
  ERGON_OFFLINE_REFUSED_KEYS,
  ERGON_OFFLINE_STATUS_LINE,
  ERGON_TASK_SNAPSHOT_STORAGE_KEY,
  findRefusedOfflineCacheKey,
} from "@/lib/ergon/offline";

describe("ergon offline policy", () => {
  test("only view_cached_board is allowed offline — no invented write sync", () => {
    expect(ergonOfflineAllows("view_cached_board")).toBe(true);
    expect(ergonOfflineAllows("mutate_tasks")).toBe(false);
    expect(ergonOfflineAllows("llm_enhance")).toBe(false);
    expect(ergonOfflineAllows("auth_bootstrap")).toBe(false);
  });

  test("snapshot storage key is fixed and status copy is quiet", () => {
    expect(ERGON_TASK_SNAPSHOT_STORAGE_KEY).toBe("organic-llm.ergon.tasks.v1");
    expect(ERGON_OFFLINE_STATUS_LINE.toLowerCase()).toContain("offline");
    expect(ERGON_OFFLINE_REFUSED_KEYS).toContain("token");
    expect(ERGON_OFFLINE_REFUSED_KEYS).toContain("secret");
  });

  test("accepts a plain task snapshot and refuses tokens / hub notes", () => {
    const tasks = [
      {
        id: "t1",
        title: "Ship Ergon mobile",
        notes: "Tighten the phone layout",
        status: "todo",
        category: null,
      },
    ];

    expect(canCacheErgonSnapshot({ tasks, updatedAt: 1 })).toBe(true);
    expect(findRefusedOfflineCacheKey({ tasks })).toBeNull();

    expect(findRefusedOfflineCacheKey({ access_token: "sk-live" })).toBe("access_token");
    expect(canCacheErgonSnapshot({ tasks, apiKey: "x" })).toBe(false);
    expect(findRefusedOfflineCacheKey({ hub_notes: "private" })).toBe("hub_notes");
    expect(findRefusedOfflineCacheKey({ nested: { refresh_token: "r" } })).toBe("refresh_token");
  });
});

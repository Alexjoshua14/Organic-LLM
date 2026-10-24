import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  cachedProfileId,
  clearProfileIdCache,
  PROFILE_ID_CACHE_MAX,
  PROFILE_ID_TTL_MS,
} from "@/lib/supabase/profile-id-cache";

const ok = (id: string) => ({ data: id, error: null });

describe("cachedProfileId", () => {
  let clock = 0;
  const now = () => clock;

  beforeEach(() => {
    clearProfileIdCache();
    clock = 1_000;
  });

  test("looks up once, then serves the id from cache", async () => {
    const load = mock(async () => ok("profile-1"));

    expect(await cachedProfileId("clerk-1", load, now)).toEqual(ok("profile-1"));
    expect(await cachedProfileId("clerk-1", load, now)).toEqual(ok("profile-1"));
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("looks up again once the entry expires", async () => {
    const load = mock(async () => ok("profile-1"));

    await cachedProfileId("clerk-1", load, now);
    clock += PROFILE_ID_TTL_MS + 1;
    await cachedProfileId("clerk-1", load, now);

    expect(load).toHaveBeenCalledTimes(2);
  });

  test("never caches a failure, so a new signup resolves once its profile exists", async () => {
    const load = mock(async () => ({ data: null, error: new Error("no rows") }));

    expect((await cachedProfileId("clerk-new", load, now)).error).toBeInstanceOf(Error);

    load.mockImplementation(async () => ok("profile-new") as never);

    expect(await cachedProfileId("clerk-new", load, now)).toEqual(ok("profile-new"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("concurrent lookups for one user share a single query", async () => {
    let resolve: (value: ReturnType<typeof ok>) => void = () => {};
    const load = mock(() => new Promise<ReturnType<typeof ok>>((r) => (resolve = r)));

    const pending = Promise.all([
      cachedProfileId("clerk-1", load, now),
      cachedProfileId("clerk-1", load, now),
    ]);

    resolve(ok("profile-1"));

    expect(await pending).toEqual([ok("profile-1"), ok("profile-1")]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("evicts the oldest entry at capacity", async () => {
    for (let i = 0; i < PROFILE_ID_CACHE_MAX; i += 1) {
      await cachedProfileId(`clerk-${i}`, async () => ok(`profile-${i}`), now);
    }
    await cachedProfileId("clerk-extra", async () => ok("profile-extra"), now);

    const reload = mock(async () => ok("profile-0"));

    await cachedProfileId("clerk-0", reload, now);
    expect(reload).toHaveBeenCalledTimes(1);

    const cached = mock(async () => ok("unused"));

    await cachedProfileId("clerk-extra", cached, now);
    expect(cached).not.toHaveBeenCalled();
  });
});

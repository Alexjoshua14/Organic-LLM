import { afterEach, expect, mock, spyOn, test } from "bun:test";

import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { readTokenAnalytics } from "@/data/supabase/token-analytics";

let restore: { mockRestore(): void } | undefined;
afterEach(() => restore?.mockRestore());
const bucket = {
  day: "2026-11-13",
  surface: "chat",
  model: "test",
  operation: "chat",
  input: 10,
  cached: 5,
  uncached: 5,
  unknown: 0,
  output: 1,
  calls: 1,
};
test("pages grouped analytics past PostgREST's default limit", async () => {
  const range = mock(async (from: number, _to: number) => ({
    data: from === 0 ? Array(1000).fill(bucket) : [bucket],
    error: null,
  }));
  restore = spyOn(supabaseAdmin, "rpc").mockImplementation(() => ({ range }) as never);
  expect((await readTokenAnalytics("owner", "start", "end")).length).toBe(1001);
  expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
});
test("a later page failure discards partial aggregates", async () => {
  const range = mock(async (from: number, _to: number) =>
    from === 0
      ? { data: Array(1000).fill(bucket), error: null }
      : { data: null, error: { message: "unavailable" } }
  );
  restore = spyOn(supabaseAdmin, "rpc").mockImplementation(() => ({ range }) as never);
  await expect(readTokenAnalytics("owner", "start", "end")).rejects.toThrow(
    "Token aggregation failed"
  );
});
test("rejects corrupt aggregates instead of rendering NaN", async () => {
  restore = spyOn(supabaseAdmin, "rpc").mockImplementation(
    () => ({ range: async () => ({ data: [{ ...bucket, input: "bad" }], error: null }) }) as never
  );
  await expect(readTokenAnalytics("owner", "start", "end")).rejects.toThrow(
    "Invalid token aggregate"
  );
});

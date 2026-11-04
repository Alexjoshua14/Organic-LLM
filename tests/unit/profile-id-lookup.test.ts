import { beforeEach, describe, expect, test } from "bun:test";

import { ProfileNotFoundError, profileIdResult } from "@/data/supabase/profile-id-lookup";
import { cachedProfileId, clearProfileIdCache } from "@/lib/supabase/profile-id-cache";

beforeEach(() => clearProfileIdCache());

describe("profileIdResult", () => {
  test("a found row returns the profile id", () => {
    expect(profileIdResult({ data: { id: "sb_1" }, error: null })).toEqual({
      data: "sb_1",
      error: null,
    });
  });

  test("zero rows is ProfileNotFoundError", () => {
    const result = profileIdResult({ data: null, error: null });

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(ProfileNotFoundError);
  });

  test("a database error is a plain failure, not a missing profile", () => {
    const result = profileIdResult({ data: null, error: { message: "connection reset" } });

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).not.toBeInstanceOf(ProfileNotFoundError);
    expect(result.error?.message).toBe("connection reset");
  });

  test("through the profile-id cache, a missing profile is not cached", async () => {
    let row: Parameters<typeof profileIdResult>[0] = { data: null, error: null };
    let queries = 0;
    const lookup = () =>
      cachedProfileId("clerk_new", async () => {
        queries += 1;

        return profileIdResult(row);
      });

    expect((await lookup()).error).toBeInstanceOf(ProfileNotFoundError);
    // The signup webhook lands; the next lookup must see the row, not a cached miss.
    row = { data: { id: "sb_new" }, error: null };
    expect(await lookup()).toEqual({ data: "sb_new", error: null });
    expect(await lookup()).toEqual({ data: "sb_new", error: null });
    expect(queries).toBe(2);
  });
});

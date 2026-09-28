// Runs in its own Bun process so identity mocks cannot affect unrelated tests.
import { strict as assert } from "node:assert";
import { mock } from "bun:test";

let clerkUserId: string | null = "clerk-owner";
let admin = false;
let profileId: string | null = "profile-owner";
mock.module("server-only", () => ({}));
mock.module("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerkUserId }) }));
mock.module("@/data/supabase/profiles", () => ({
  getShowSandboxGateway: async () => true,
  isAdminUser: async () => admin,
  getSupabaseUserId: async () => ({ data: profileId, error: profileId ? null : "missing" }),
}));
const { requireAdmin } = await import("@/lib/admin/require-admin");

assert.equal(await requireAdmin(), null, "A visible sandbox is not admin authorization");
admin = true;
assert.deepEqual(await requireAdmin(), { clerkUserId: "clerk-owner", sbUserId: "profile-owner" });
profileId = null;
assert.equal(await requireAdmin(), null, "A missing profile denies access");
clerkUserId = null;
assert.equal(await requireAdmin(), null, "A signed-out user cannot read approved notes");

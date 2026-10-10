import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as clerk from "@clerk/nextjs/server";
import * as supabase from "@/lib/supabase/server";
import * as health from "@/lib/health/run-health-checks";

import { GET as getStatus } from "@/app/api/status/route";
import { getGatewayVisibilityForCurrentUser } from "@/data/supabase/gateway-visibility";
import { isAdminUser } from "@/lib/admin/read-admin-profile";
import { requireAdmin } from "@/lib/admin/require-admin";
import { mockModulePreservingReal } from "../helpers/module-mock";

const identity = { userId: "user_test", sessionId: "session_test" };
let authIdentity: { userId: string | null; sessionId: string | null };
let membership: Record<string, unknown> | null;
let dbError: { message: string; code?: string } | null;
let dbThrows: boolean;
let restore: Array<() => void>;
const select = mock((_fields: string) => ({ eq }));
const eq = mock((_field: string, _value: string) => ({
  maybeSingle: async () => ({ data: membership, error: dbError }),
}));
const from = mock((_table: string) => ({ select }));
const runHealthChecks = mock(async () => ({ ok: true }) as never);

beforeEach(() => {
  authIdentity = { ...identity };
  membership = { profile_id: "profile_test" };
  dbError = null;
  dbThrows = false;
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  runHealthChecks.mockClear();
  restore = [
    mockModulePreservingReal("@clerk/nextjs/server", clerk, {
      auth: (async () => authIdentity) as never,
    }),
    mockModulePreservingReal("@/lib/supabase/server", supabase, {
      supabaseServer: (async () => {
        if (dbThrows) throw new Error("Service unavailable");

        return { from };
      }) as never,
    }),
    mockModulePreservingReal("@/lib/health/run-health-checks", health, { runHealthChecks }),
  ];
});

afterEach(() => {
  for (const reset of restore.reverse()) reset();
});

describe("gateway visibility security", () => {
  test("signed-out requests never read membership", async () => {
    authIdentity = { userId: null, sessionId: null };

    expect(await getGatewayVisibilityForCurrentUser(identity)).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  test("forged, stale, and malformed cache identities are rejected before the database", async () => {
    const invalid = [
      { ...identity, userId: "another_user" },
      { ...identity, sessionId: "another_session" },
      { ...identity, admin: true },
      { userId: identity.userId },
      { ...identity, sessionId: "" },
      null,
    ];

    for (const value of invalid) {
      await expect(getGatewayVisibilityForCurrentUser(value as never)).rejects.toThrow(
        "Gateway visibility session changed."
      );
    }
    expect(from).not.toHaveBeenCalled();
  });

  test("reads only minimal access fields for the authenticated user", async () => {
    expect(await getGatewayVisibilityForCurrentUser(identity)).toBe(true);
    expect(from).toHaveBeenCalledWith("admin_access");
    expect(select).toHaveBeenCalledWith("profile_id, profiles!inner(id)");
    expect(eq).toHaveBeenCalledWith("profiles.clerk_user_id", identity.userId);
  });

  test("lookup failures are retryable errors without leaking database details", async () => {
    dbError = { message: "private database details" };

    await expect(getGatewayVisibilityForCurrentUser(identity)).rejects.toThrow(
      "Unable to load profile access."
    );
  });

  test("an unapplied migration denies access without throwing or allowing protected operations", async () => {
    dbError = {
      code: "PGRST205",
      message: "Could not find the table 'public.admin_access' in the schema cache",
    };

    expect(await getGatewayVisibilityForCurrentUser(identity)).toBe(false);
    expect(await requireAdmin()).toBeNull();
    expect(await isAdminUser(identity.userId)).toBe(false);
    expect((await getStatus(new Request("http://localhost/api/status"))).status).toBe(403);
    expect(runHealthChecks).not.toHaveBeenCalled();
  });
});

describe("fresh server authorization", () => {
  test("only a valid membership grants access; profile flags cannot grant access", async () => {
    for (const denied of [
      null,
      { id: "profile_test" },
      { id: "profile_test", admin: true },
      { admin: true },
      { profile_id: null },
      { profile_id: 1 },
      { profile_id: "" },
    ]) {
      membership = denied;
      expect(await requireAdmin()).toBeNull();
      expect(await isAdminUser(identity.userId)).toBe(false);
      expect(await getGatewayVisibilityForCurrentUser(identity)).toBe(false);
    }

    membership = { profile_id: "profile_test" };
    expect(await requireAdmin()).toEqual({
      clerkUserId: identity.userId,
      sbUserId: "profile_test",
    });
  });

  test("missing authentication and failed lookups deny protected operations", async () => {
    authIdentity = { userId: null, sessionId: null };
    expect(await requireAdmin()).toBeNull();
    expect(from).not.toHaveBeenCalled();

    authIdentity = { ...identity };
    dbError = { message: "database unavailable" };
    expect(await requireAdmin()).toBeNull();
    expect(await isAdminUser(identity.userId)).toBe(false);

    dbError = null;
    dbThrows = true;
    expect(await requireAdmin()).toBeNull();
    expect(await isAdminUser(identity.userId)).toBe(false);
  });

  test("revocation takes effect on the next server request", async () => {
    expect(await requireAdmin()).not.toBeNull();
    membership = null;
    expect(await requireAdmin()).toBeNull();
    expect(from).toHaveBeenCalledTimes(2);
  });

  test("status never executes health checks for signed-out, non-admin, or unavailable membership", async () => {
    const request = new Request("http://localhost/api/status");
    authIdentity = { userId: null, sessionId: null };
    expect((await getStatus(request)).status).toBe(401);
    expect(from).not.toHaveBeenCalled();

    authIdentity = { ...identity };
    membership = null;
    expect((await getStatus(request)).status).toBe(403);

    membership = { profile_id: "profile_test" };
    dbError = { message: "unavailable" };
    expect((await getStatus(request)).status).toBe(403);
    expect(runHealthChecks).not.toHaveBeenCalled();

    dbError = null;
    expect((await getStatus(request)).status).toBe(200);
    expect(runHealthChecks).toHaveBeenCalledTimes(1);
  });
});

import { z } from "zod";
import type { consumeUsageReset } from "@/data/supabase/account-entitlements";
import type { getPlanBudgetForUser } from "@/lib/plans/plan-budget";

type ResetDeps = {
  auth(): Promise<{ userId: string | null }>;
  getSupabaseUserId(clerkUserId: string): Promise<{ data: string | null; error: unknown }>;
  consumeUsageReset: typeof consumeUsageReset;
  getPlanBudgetForUser: typeof getPlanBudgetForUser;
};
const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store" },
  });
const ResetSchema = z.object({ resetVersion: z.string().datetime({ offset: true }) }).strict();

/**
 * POST /api/usage/reset — spend one reset credit to start a fresh weekly budget window now.
 * Compare-and-set in the database: retries and concurrent submissions of the same window
 * consume at most one credit. Identity always comes from the signed-in session.
 */
export function createUsageResetHandler(deps: ResetDeps) {
  return async function POST(req: Request) {
    if (
      req.headers.get("sec-fetch-site") === "cross-site" ||
      (req.headers.has("origin") && req.headers.get("origin") !== new URL(req.url).origin)
    )
      return json({ error: "Invalid origin" }, { status: 403 });

    if (!req.headers.get("content-type")?.startsWith("application/json")) {
      return json({ error: "JSON body required" }, { status: 415 });
    }
    const clerkUser = await deps.auth();

    if (!clerkUser?.userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const sbUserIdResult = await deps.getSupabaseUserId(clerkUser.userId);

    if (sbUserIdResult.error || !sbUserIdResult.data) {
      return json({ error: "User not found" }, { status: 404 });
    }

    const ownerId = sbUserIdResult.data;
    const parsed = ResetSchema.safeParse(await req.json().catch(() => null));

    if (!parsed.success) return json({ error: "Invalid reset request" }, { status: 400 });

    const before = await deps.getPlanBudgetForUser({ clerkUserId: clerkUser.userId, ownerId });
    if (before.status === "unavailable")
      return json({ error: "Usage is unavailable. No reset was spent." }, { status: 503 });
    const result = await deps.consumeUsageReset(ownerId, parsed.data.resetVersion);

    if (result.status === "conflict") {
      return json(
        { error: "This window has changed or no resets remain. Refresh Usage." },
        { status: 409 }
      );
    }
    if (result.status === "unavailable") {
      return json({ error: "Resets are unavailable right now" }, { status: 503 });
    }

    const plan = await deps.getPlanBudgetForUser({ clerkUserId: clerkUser.userId, ownerId });

    return json({ plan, resetApplied: true });
  };
}

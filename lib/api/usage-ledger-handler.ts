import { z } from "zod";

import type { AdminContext } from "@/lib/admin/require-admin";
import type { UsageAdjustmentInput } from "@/data/supabase/usage-ledger";

const PageSchema = z.object({
  ownerId: z.string().uuid(),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
const AdjustmentSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string().uuid(),
    eventId: z.string().uuid().nullable().default(null),
    deltaUsd: z
      .number()
      .finite()
      .min(-100_000)
      .max(100_000)
      .multipleOf(0.000001)
      .refine((n) => n !== 0),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

type LedgerDeps = {
  requireAdmin(): Promise<AdminContext | null>;
  read(ownerId: string, offset: number): Promise<unknown>;
  append(input: UsageAdjustmentInput): Promise<unknown | null>;
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function createUsageLedgerHandlers(deps: LedgerDeps) {
  return {
    GET: async (req: Request) => {
      if (!(await deps.requireAdmin())) return json({ error: "Forbidden" }, 403);
      const parsed = PageSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
      if (!parsed.success) return json({ error: "Invalid ledger query" }, 400);
      try {
        return json(await deps.read(parsed.data.ownerId, parsed.data.offset));
      } catch {
        return json({ error: "Usage ledger unavailable" }, 503);
      }
    },
    POST: async (req: Request) => {
      const admin = await deps.requireAdmin();
      if (!admin) return json({ error: "Forbidden" }, 403);
      if (
        req.headers.get("sec-fetch-site") === "cross-site" ||
        (req.headers.has("origin") && req.headers.get("origin") !== new URL(req.url).origin)
      ) {
        return json({ error: "Invalid origin" }, 403);
      }
      if (!req.headers.get("content-type")?.startsWith("application/json"))
        return json({ error: "JSON body required" }, 415);
      const parsed = AdjustmentSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return json({ error: "Invalid adjustment" }, 400);
      try {
        const adjustment = await deps.append({ ...parsed.data, actorId: admin.sbUserId });
        return adjustment
          ? json({ adjustment })
          : json({ error: "Adjustment ID already used for different data" }, 409);
      } catch {
        return json({ error: "Adjustment could not be recorded" }, 503);
      }
    },
  };
}

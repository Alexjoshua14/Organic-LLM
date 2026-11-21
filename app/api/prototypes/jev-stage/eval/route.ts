import { z } from "zod";
import { NextResponse } from "next/server";

import { upsertJevStageTurnEval } from "@/data/supabase/jev-stage-turn-eval";
import { requireLabAccess } from "@/lib/admin/lab-access";
import { setJevStageTurnEval } from "@/lib/jev-stage/turn";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

const BodySchema = z
  .object({
    turnId: z.string().uuid(),
    signal: z.enum(["up", "down"]),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const lab = await requireLabAccess();

    if (!lab) return json({ error: "Unauthorized" }, 401);
    let raw: unknown;

    try {
      raw = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) return json({ error: "Invalid eval" }, 400);

    // Durable row first — Redis alone must not look like a successful save.
    const durable = await upsertJevStageTurnEval({
      userId: lab.sbUserId,
      turnId: parsed.data.turnId,
      signal: parsed.data.signal,
      note: parsed.data.note,
    });

    if (durable.error || !durable.data) {
      return json(
        {
          error: "Could not persist eval",
          durableError: durable.error ?? "missing row",
        },
        502
      );
    }

    const bundle = await setJevStageTurnEval({
      ownerId: lab.sbUserId,
      turnId: parsed.data.turnId,
      signal: parsed.data.signal,
      note: parsed.data.note,
    });

    return json({ bundle, durable: durable.data });
  } catch {
    return json({ error: "Could not save eval" }, 500);
  }
}

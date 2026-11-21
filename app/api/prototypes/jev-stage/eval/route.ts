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
    const parsed = BodySchema.safeParse(await req.json());

    if (!parsed.success) return json({ error: "Invalid eval" }, 400);

    // Redis insight updates immediately so the panel stays in sync.
    const bundle = await setJevStageTurnEval({
      ownerId: lab.sbUserId,
      turnId: parsed.data.turnId,
      signal: parsed.data.signal,
      note: parsed.data.note,
    });

    // Durable lean row when the migration is present.
    const durable = await upsertJevStageTurnEval({
      userId: lab.sbUserId,
      turnId: parsed.data.turnId,
      signal: parsed.data.signal,
      note: parsed.data.note,
    });

    return json({
      bundle,
      durable: durable.data,
      durableError: durable.error,
    });
  } catch {
    return json({ error: "Could not save eval" }, 500);
  }
}

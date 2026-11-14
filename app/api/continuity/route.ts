import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { checkStageLimit } from "@/lib/stage/limit";
import { ContinuitySourceSchema } from "@/lib/continuity/schema";
import { ContinuityError, continuityStore } from "@/lib/continuity/store";
import { discoverContinuity, readContinuitySource } from "@/lib/continuity/sources";

export const maxDuration = 15;
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

async function identity() {
  const { userId } = await auth();

  if (!userId) throw new ContinuityError("Unauthorized", 401);
  const result = await getSupabaseUserIdCached(userId);

  if (result.error || !result.data) throw new ContinuityError("Unauthorized", 401);
  if (!(await checkStageLimit(result.data))) throw new ContinuityError("Too many requests", 429);

  return result.data;
}
function failure(error: unknown) {
  if (error instanceof ContinuityError) return reply({ error: error.message }, error.status);

  return reply({ error: "Context selection unavailable. Please try again." }, 503);
}
const Search = z.object({
  kind: z.enum(["speak-thread", "stage-artifact"]),
  query: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function GET(req: Request) {
  try {
    const owner = await identity();
    const args = Search.safeParse(Object.fromEntries(new URL(req.url).searchParams));

    if (!args.success) return reply({ error: "Invalid search" }, 400);

    return reply(await discoverContinuity(owner, args.data));
  } catch (error) {
    return failure(error);
  }
}
const Mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), surface: z.enum(["speak", "stage"]) }).strict(),
  z
    .object({
      action: z.literal("select"),
      interactionId: z.string().uuid(),
      expectedRevision: z.number().int().nonnegative(),
      requestId: z.string().uuid(),
      source: ContinuitySourceSchema.nullable(),
    })
    .strict(),
]);

export async function POST(req: Request) {
  try {
    const owner = await identity();
    const text = await req.text();

    if (text.length > 4096) return reply({ error: "Request too large" }, 413);
    let raw: unknown;

    try {
      raw = JSON.parse(text);
    } catch {
      return reply({ error: "Invalid request" }, 400);
    }
    const args = Mutation.safeParse(raw);

    if (!args.success) return reply({ error: "Invalid selection" }, 400);
    if (args.data.action === "create") {
      const record = await continuityStore.create(owner, args.data.surface);

      return reply({
        interactionId: record.interactionId,
        revision: record.revision,
        selected: record.selected,
      });
    }

    return reply(
      await continuityStore.select(owner, args.data, async (source) => {
        await readContinuitySource(owner, source, false);
      })
    );
  } catch (error) {
    return failure(error);
  }
}

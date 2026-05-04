import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { truncateMemoryBlobToTokenCap } from "@/lib/memory/lens-overview-input";
import { generateLensOverviewTextCached } from "@/lib/memory/lens-overview-llm";
import { getMemoriesOwnershipSnapshotForUser } from "@/lib/memory/operations";
import { createLogger } from "@/lib/logger";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

export const maxDuration = 30;

const logger = createLogger("app/api/memory/lens-overview/route.ts");

const BodySchema = z.object({
  memoryIds: z.array(z.string().min(1).max(256)).max(100),
});

export async function POST(req: Request) {
  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { memoryIds } = parsed.data;

  if (memoryIds.length === 0) {
    return Response.json({ error: "memoryIds must not be empty" }, { status: 400 });
  }

  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const sbUserId = sbUserIdResult.data;

  const limitResult = await checkLlmMessageLimit(sbUserId);

  if (!limitResult.success) {
    return Response.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  const snapshot = await getMemoriesOwnershipSnapshotForUser(sbUserId);

  if (snapshot.error || snapshot.data === null) {
    logger.warn("POST", "memory snapshot failed", snapshot.error);

    return Response.json({ error: "Memory service may be unavailable." }, { status: 503 });
  }

  const byId = new Map((snapshot.data.results ?? []).map((m) => [m.id, m.memory]));

  const orderedTexts: string[] = [];

  for (const id of memoryIds) {
    const text = byId.get(id);

    if (text === undefined) {
      return Response.json({ error: "Invalid memory selection" }, { status: 403 });
    }
    orderedTexts.push(text);
  }

  const userBlob = truncateMemoryBlobToTokenCap(orderedTexts);

  try {
    const overview = await generateLensOverviewTextCached(sbUserId, userBlob);

    return Response.json({ overview });
  } catch (err) {
    logger.error("POST", "generateText failed", err);

    return Response.json({ error: "Overview generation failed" }, { status: 500 });
  }
}

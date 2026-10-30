import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NextResponse } from "next/server";

import { runStageTurn, scheduleStageDesign, StageTurnError } from "@/lib/stage/turn";
import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";
import { designIsStale } from "@/lib/stage/design";
import { applyStageOperations, StageLayoutError } from "@/lib/stage/layout";
import { checkStageLimit } from "@/lib/stage/limit";
import { readStagePayload, StagePayloadError } from "@/lib/stage/request";
import { StageMutationSchema, StageTurnSchema, type StageState } from "@/lib/stage/schema";
import {
  acquireStageLease,
  hasStageRequest,
  mutateStage,
  readStage,
  releaseStageLease,
} from "@/lib/stage/store";

export const maxDuration = 180;

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function identity() {
  const { userId } = await auth();

  if (!userId) return null;
  const profile = await getSupabaseUserIdCached(userId);

  if (profile.error || !profile.data) return null;

  return { clerkUserId: userId, ownerId: profile.data };
}

function errorStatus(error: unknown) {
  if (error instanceof StageTurnError) return json({ error: error.message }, error.status);
  if (error instanceof StagePayloadError) return json({ error: error.message }, 413);
  if (error instanceof StageLayoutError) return json({ error: error.message }, 400);

  return json({ error: "Stage request failed" }, 500);
}

export async function GET() {
  try {
    const id = await identity();

    if (!id) return json({ error: "Unauthorized" }, 401);
    if (!(await checkStageLimit(id.ownerId))) return json({ error: "Too many requests" }, 429);
    let { state } = await readStage(id.ownerId);

    if (designIsStale(state)) {
      const recovered = await mutateStage(id.ownerId, "design-failed", (current) =>
        designIsStale(current)
          ? {
              ...current,
              design: {
                ...current.design!,
                status: "failed",
                error: "Design timed out. Retry when ready.",
              },
            }
          : null
      );

      state = recovered ?? (await readStage(id.ownerId)).state;
    }
    // Polling also resumes queued work after a prior invocation ended. The designer lease deduplicates workers.
    scheduleStageDesign(id, state);

    return json({ state });
  } catch {
    return json({ error: "Could not load stage" }, 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const id = await identity();

    if (!id) return json({ error: "Unauthorized" }, 401);
    if (!(await checkStageLimit(id.ownerId, true)))
      return json({ error: "Too many requests" }, 429);
    const parsed = StageMutationSchema.safeParse(await readStagePayload(req));

    if (!parsed.success) return json({ error: "Invalid layout request" }, 400);
    let conflict: StageState | null = null;
    const state = await mutateStage(id.ownerId, "layout", (current) => {
      if (current.revision !== parsed.data.revision) {
        conflict = current;

        return null;
      }

      return { ...current, widgets: applyStageOperations(current.widgets, parsed.data.operations) };
    });

    if (!state) return json({ error: "Stage changed", state: conflict }, 409);

    return json({ state });
  } catch (error) {
    return errorStatus(error);
  }
}

export async function POST(req: Request) {
  try {
    const id = await identity();

    if (!id) return json({ error: "Unauthorized" }, 401);
    if (!(await checkStageLimit(id.ownerId, true)))
      return json({ error: "Too many requests" }, 429);
    const raw = await readStagePayload(req);
    const retry = z
      .object({ action: z.literal("retry-design"), requestId: z.string().uuid() })
      .strict()
      .safeParse(raw);
    const parsed = StageTurnSchema.safeParse(raw);

    if (!retry.success && !parsed.success) return json({ error: "Invalid message" }, 400);
    if (parsed.success) {
      const state = await runStageTurn(
        id,
        parsed.data.message,
        parsed.data.requestId,
        parsed.data.settings
      );

      return json({ state });
    }
    if (!retry.success) return json({ error: "Invalid message" }, 400);
    const requestId = retry.data.requestId;

    if (await hasStageRequest(id.ownerId, requestId))
      return json({ state: (await readStage(id.ownerId)).state });
    const lease = await acquireStageLease(id.ownerId, "turn");

    if (!lease)
      return json({ error: "The central agent is answering another message. Retry shortly." }, 409);
    try {
      if (await hasStageRequest(id.ownerId, requestId))
        return json({ state: (await readStage(id.ownerId)).state });
      const gate = await requirePlanBudget({ clerkUserId: id.clerkUserId, sbUserId: id.ownerId });

      if (gate) {
        gate.headers.set("Cache-Control", "private, no-store");

        return gate;
      }
      if (retry.success) {
        const state = await mutateStage(
          id.ownerId,
          "design-start",
          (current) => {
            if (!current.design || (current.design.status !== "failed" && !designIsStale(current)))
              return null;

            return {
              ...current,
              design: {
                id: requestId,
                status: "working",
                startedAt: new Date().toISOString(),
                brief: current.design.brief,
              },
            };
          },
          { requestId, deduplicate: true, lease }
        );

        if (!state) return json({ error: "No design to retry" }, 409);
        scheduleStageDesign(id, state);

        return json({ state });
      }
    } finally {
      await releaseStageLease(id.ownerId, lease);
    }
  } catch (error) {
    return errorStatus(error);
  }
}

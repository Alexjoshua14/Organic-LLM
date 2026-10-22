import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { after, NextResponse } from "next/server";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { generateStageTurn, modelForTier, StageGenerationError } from "@/lib/stage/agent";
import { designIsStale, runStageDesign } from "@/lib/stage/design";
import { applyStageOperations, StageLayoutError } from "@/lib/stage/layout";
import { checkStageLimit } from "@/lib/stage/limit";
import { readStagePayload, StagePayloadError } from "@/lib/stage/request";
import { STAGE_MAX_PENDING_DESIGNS, StageMutationSchema, StageTurnSchema, type StageState } from "@/lib/stage/schema";
import { acquireStageLease, hasStageRequest, mutateStage, readStage, releaseStageLease } from "@/lib/stage/store";

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
  if (error instanceof StagePayloadError) return json({ error: error.message }, 413);
  if (error instanceof StageLayoutError) return json({ error: error.message }, 400);
  return json({ error: "Stage request failed" }, 500);
}

function scheduleDesign(id: { ownerId: string; clerkUserId: string }, state: StageState) {
  const job = state.design;
  if (job?.status === "working") after(() => runStageDesign({ ...id, jobId: job.id, base: state, brief: job.brief }));
}

export async function GET() {
  try {
    const id = await identity();
    if (!id) return json({ error: "Unauthorized" }, 401);
    if (!(await checkStageLimit(id.ownerId))) return json({ error: "Too many requests" }, 429);
    let { state } = await readStage(id.ownerId);
    if (designIsStale(state)) {
      const recovered = await mutateStage(id.ownerId, "design-failed", (current) =>
        designIsStale(current) ? { ...current, design: { ...current.design!, status: "failed", error: "Design timed out. Retry when ready." } } : null);
      state = recovered ?? (await readStage(id.ownerId)).state;
    }
    // Polling also resumes queued work after a prior invocation ended. The designer lease deduplicates workers.
    scheduleDesign(id, state);
    return json({ state });
  } catch { return json({ error: "Could not load stage" }, 500); }
}

export async function PATCH(req: Request) {
  try {
    const id = await identity();
    if (!id) return json({ error: "Unauthorized" }, 401);
    if (!(await checkStageLimit(id.ownerId, true))) return json({ error: "Too many requests" }, 429);
    const parsed = StageMutationSchema.safeParse(await readStagePayload(req));
    if (!parsed.success) return json({ error: "Invalid layout request" }, 400);
    let conflict: StageState | null = null;
    const state = await mutateStage(id.ownerId, "layout", (current) => {
      if (current.revision !== parsed.data.revision) { conflict = current; return null; }
      return { ...current, widgets: applyStageOperations(current.widgets, parsed.data.operations) };
    });
    if (!state) return json({ error: "Stage changed", state: conflict }, 409);
    return json({ state });
  } catch (error) { return errorStatus(error); }
}

export async function POST(req: Request) {
  try {
    const id = await identity();
    if (!id) return json({ error: "Unauthorized" }, 401);
    if (!(await checkStageLimit(id.ownerId, true))) return json({ error: "Too many requests" }, 429);
    const raw = await readStagePayload(req);
    const retry = z.object({ action: z.literal("retry-design"), requestId: z.string().uuid() }).strict().safeParse(raw);
    const parsed = StageTurnSchema.safeParse(raw);
    if (!retry.success && !parsed.success) return json({ error: "Invalid message" }, 400);
    const requestId = retry.success ? retry.data.requestId : parsed.data!.requestId;
    if (await hasStageRequest(id.ownerId, requestId)) return json({ state: (await readStage(id.ownerId)).state });
    const lease = await acquireStageLease(id.ownerId, "turn");
    if (!lease) return json({ error: "The central agent is answering another message. Retry shortly." }, 409);
    try {
      if (await hasStageRequest(id.ownerId, requestId)) return json({ state: (await readStage(id.ownerId)).state });
      const { state: base } = await readStage(id.ownerId);
      if (!retry.success && base.design && base.pendingDesigns.length >= STAGE_MAX_PENDING_DESIGNS) {
        return json({ error: "The designer queue is full. Wait for a design to finish." }, 409);
      }
      const gate = await requirePlanBudget({ clerkUserId: id.clerkUserId, sbUserId: id.ownerId });
      if (gate) { gate.headers.set("Cache-Control", "private, no-store"); return gate; }
      if (retry.success) {
        const state = await mutateStage(id.ownerId, "design-start", (current) => {
          if (!current.design || (current.design.status !== "failed" && !designIsStale(current))) return null;
          return { ...current, design: { id: requestId, status: "working", startedAt: new Date().toISOString(), brief: current.design.brief } };
        }, { requestId, deduplicate: true, lease });
        if (!state) return json({ error: "No design to retry" }, 409);
        scheduleDesign(id, state);
        return json({ state });
      }
      const limited = await checkLlmMessageLimit(id.ownerId);
      if (!limited.success) return json({ error: limited.error ?? "Too many messages" }, 429);
      let result;
      try {
        result = await generateStageTurn({ ...id, state: base, message: parsed.data!.message });
      } catch (error) {
        if (error instanceof StageGenerationError) {
          await mutateStage(id.ownerId, "turn-failed", (current) => ({ ...current, lastModel: error.model }), {
            requestId, deduplicate: true, usage: error.usage,
            call: { operation: "turn", model: error.model, outcome: "failed" },
          });
        }
        throw error;
      }
      const job = result.designBrief ? { id: crypto.randomUUID(), brief: result.designBrief } : null;
      const assistantId = crypto.randomUUID();
      const state = await mutateStage(id.ownerId, "turn", (current) => {
        const design = job && !current.design ? { ...job, status: "working" as const, startedAt: new Date().toISOString() } : current.design;
        return {
          ...current,
          messages: [...current.messages, { id: requestId, role: "user" as const, text: parsed.data!.message }, { id: assistantId, role: "assistant" as const, text: result.reply }].slice(-24),
          summary: result.summary,
          lastModel: result.model, nextModel: modelForTier(result.nextTier), design,
          pendingDesigns: job && current.design ? [...current.pendingDesigns, job] : current.pendingDesigns,
        };
      }, { requestId, deduplicate: true, usage: result.usage, lease, call: { operation: "turn", model: result.model, outcome: "complete" } });
      const latest = state ?? (await readStage(id.ownerId)).state;
      scheduleDesign(id, latest);
      return json({ state: latest });
    } finally { await releaseStageLease(id.ownerId, lease); }
  } catch (error) { return errorStatus(error); }
}

import { z } from "zod";
import { NextResponse } from "next/server";

import { requireLabAccess } from "@/lib/admin/lab-access";
import { JEV_STAGE_HEARTBEAT_MS } from "@/lib/jev-stage/constants";
import {
  cancelJevStageDesign,
  retryJevStageDesign,
  scheduleJevStageDesign,
} from "@/lib/jev-stage/design";
import { checkJevStageLimit } from "@/lib/jev-stage/limit";
import { JevStageTurnRequestSchema, type JevStageStreamEvent } from "@/lib/jev-stage/schema";
import { readJevStage } from "@/lib/jev-stage/store";
import { JevStageTurnError, resetJevStage, runJevStageTurn } from "@/lib/jev-stage/turn";

export const maxDuration = 300;

const DESIGN_BACKGROUND_START_WINDOW_MS = 25_000;

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

function ndjsonStream(run: (emit: (event: JevStageStreamEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  let disconnected = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: JevStageStreamEvent) => {
        if (disconnected) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const heartbeat = setInterval(() => emit({ type: "heartbeat" }), JEV_STAGE_HEARTBEAT_MS);

      try {
        await run(emit);
      } catch (error) {
        const message =
          error instanceof JevStageTurnError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Jev Stage turn failed";

        emit({ type: "error", message });
      } finally {
        clearInterval(heartbeat);
        if (!disconnected) controller.close();
      }
    },
    cancel() {
      disconnected = true;
    },
  });

  return new Response(stream, {
    headers: {
      ...headers,
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}

export async function GET() {
  try {
    const lab = await requireLabAccess();

    if (!lab) return json({ error: "Unauthorized" }, 401);
    if (!(await checkJevStageLimit(lab.sbUserId))) return json({ error: "Too many requests" }, 429);
    const bundle = await readJevStage(lab.sbUserId);

    scheduleJevStageDesign({ ownerId: lab.sbUserId, clerkUserId: lab.clerkUserId }, bundle.stage);

    return json(bundle);
  } catch {
    return json({ error: "Could not load Jev Stage" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const lab = await requireLabAccess();

    if (!lab) return json({ error: "Unauthorized" }, 401);
    if (!(await checkJevStageLimit(lab.sbUserId, true)))
      return json({ error: "Too many requests" }, 429);
    let raw: unknown;

    try {
      raw = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const identity = { ownerId: lab.sbUserId, clerkUserId: lab.clerkUserId };
    const design = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("retry-design") }).strict(),
        z.object({ action: z.literal("cancel-design"), jobId: z.string().uuid() }).strict(),
      ])
      .safeParse(raw);

    if (design.success) {
      const bundle =
        design.data.action === "retry-design"
          ? await retryJevStageDesign(identity.ownerId)
          : await cancelJevStageDesign(identity.ownerId, design.data.jobId);

      if (!bundle)
        return json({ error: "Wait for the current turn before changing the design." }, 409);
      scheduleJevStageDesign(identity, bundle.stage);

      return json(bundle);
    }

    const reset = z
      .object({ action: z.literal("reset") })
      .strict()
      .safeParse(raw);

    if (reset.success) return json(await resetJevStage(lab.sbUserId));

    const parsed = JevStageTurnRequestSchema.safeParse(raw);

    if (!parsed.success) return json({ error: "Invalid message" }, 400);

    const openedAt = performance.now();

    return ndjsonStream(async (emit) => {
      const bundle = await runJevStageTurn({
        ...identity,
        message: parsed.data.message,
        requestId: parsed.data.requestId,
        settings: parsed.data.settings,
        emit,
      });

      // Leave the designer its own invocation on a long turn. The client’s first
      // design poll will start it through GET.
      if (performance.now() - openedAt < DESIGN_BACKGROUND_START_WINDOW_MS)
        scheduleJevStageDesign(identity, bundle.stage);
    });
  } catch (error) {
    if (error instanceof JevStageTurnError) return json({ error: error.message }, error.status);

    return json({ error: "Jev Stage request failed" }, 500);
  }
}

import { z } from "zod";
import { NextResponse } from "next/server";

import { requireLabAccess } from "@/lib/admin/lab-access";
import { checkStageLimit } from "@/lib/stage/limit";
import {
  JevStageTurnRequestSchema,
  type JevStageStreamEvent,
} from "@/lib/jev-stage/schema";
import { readJevStage } from "@/lib/jev-stage/store";
import { JevStageTurnError, resetJevStage, runJevStageTurn } from "@/lib/jev-stage/turn";

export const maxDuration = 300;

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

function ndjsonStream(run: (emit: (event: JevStageStreamEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: JevStageStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

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
        controller.close();
      }
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
    if (!(await checkStageLimit(lab.sbUserId))) return json({ error: "Too many requests" }, 429);
    const bundle = await readJevStage(lab.sbUserId);

    return json(bundle);
  } catch {
    return json({ error: "Could not load Jev Stage" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const lab = await requireLabAccess();

    if (!lab) return json({ error: "Unauthorized" }, 401);
    if (!(await checkStageLimit(lab.sbUserId, true)))
      return json({ error: "Too many requests" }, 429);
    const raw = await req.json();
    const reset = z.object({ action: z.literal("reset") }).strict().safeParse(raw);

    if (reset.success) return json(await resetJevStage(lab.sbUserId));

    const parsed = JevStageTurnRequestSchema.safeParse(raw);

    if (!parsed.success) return json({ error: "Invalid message" }, 400);

    return ndjsonStream((emit) =>
      runJevStageTurn({
        ownerId: lab.sbUserId,
        clerkUserId: lab.clerkUserId,
        message: parsed.data.message,
        requestId: parsed.data.requestId,
        settings: parsed.data.settings,
        emit,
      }).then(() => undefined)
    );
  } catch (error) {
    if (error instanceof JevStageTurnError) return json({ error: error.message }, error.status);

    return json({ error: "Jev Stage request failed" }, 500);
  }
}

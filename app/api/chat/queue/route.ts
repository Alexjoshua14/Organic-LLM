import { after } from "next/server";

import { getThreadOwnerContext } from "@/data/supabase/chat";
import { listOpenQueuedMessages } from "@/data/supabase/message-send-queue";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { enqueueAndTryDispatch, tryDispatchThreadQueue } from "@/lib/message-queue/dispatch";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";
import { createLogger } from "@/lib/logger";
import { EnqueueMessageSchema } from "@/lib/schemas/message-send-queue";

// Queued turns drain in `after()`, and Arcadia subagent runs nest inside that drain — keep in
// step with SUBAGENT_RUN_MAX_DURATION_MS (lib/llm/subagents/threads/status.ts).
export const maxDuration = 300;

const logger = createLogger("app/api/chat/queue/route.ts");

/**
 * GET /api/chat/queue?threadId=...
 * Lists open queued messages for the signed-in user (optionally filtered by thread).
 */
export async function GET(req: Request) {
  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) return authGate.error;

  const { sbUserId, clerkUserId } = authGate.data!;
  const url = new URL(req.url);
  const threadId = url.searchParams.get("threadId") ?? undefined;

  if (threadId) {
    const owner = await getThreadOwnerContext(threadId);

    if (owner.error || !owner.data || owner.data.ownerId !== sbUserId) {
      return new Response(JSON.stringify({ error: "Thread not found", status: 404 }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const [items, budget] = await Promise.all([
    listOpenQueuedMessages({ ownerId: sbUserId, threadId }),
    getPlanBudgetForUser({ clerkUserId, ownerId: sbUserId }),
  ]);

  return Response.json({ items, budget });
}

/**
 * POST /api/chat/queue
 * Enqueues a message for multi-mode send. Composer stays free; server dispatches
 * when the thread is idle and plan budget allows.
 */
export async function POST(req: Request) {
  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) return authGate.error;

  const { sbUserId, clerkUserId } = authGate.data!;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON", status: 400 }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = EnqueueMessageSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request body", status: 400 }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owner = await getThreadOwnerContext(parsed.data.threadId);

  if (owner.error || !owner.data || owner.data.ownerId !== sbUserId) {
    return new Response(JSON.stringify({ error: "Thread not found", status: 404 }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await enqueueAndTryDispatch({
    ownerId: sbUserId,
    clerkUserId,
    input: parsed.data,
  });

  if ("error" in result) {
    logger.warn("POST", result.error);

    return new Response(JSON.stringify({ error: result.error, status: 503 }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Background drain if more items remain after the synchronous attempt.
  after(() =>
    tryDispatchThreadQueue({
      ownerId: sbUserId,
      clerkUserId,
      threadId: parsed.data.threadId,
    })
  );

  return Response.json({
    item: result.item,
    openQueue: result.openQueue,
    budget: result.budget,
  });
}

import z from "zod";

import { getConversationSummary, getMessages, getThreadOwnerContext } from "@/data/supabase/chat";
import { isAdminUser } from "@/data/supabase/profiles";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { clientErrorResponse } from "@/lib/api/client-safe-error";
import { resolveChatModel } from "@/lib/api/resolve-chat-model";
import { runBtwStream } from "@/lib/api/run-btw-stream";
import { loadBtwContextSnapshot } from "@/lib/chat/btw-context";
import { getChatModel } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import {
  AUTO_CHAT_MODEL_ID,
  ChatModels,
  ChatModelSchema,
  DEFAULT_CHAT_MODEL,
} from "@/lib/schemas/chat";
import { ChatEffortLevelSchema } from "@/lib/schemas/chat-effort";

export const maxDuration = 60;

const logger = createLogger("app/api/chat/[id]/btw/route.ts");

const BtwRequestSchema = z.object({
  /** The side thread so far, oldest first, ending with the new question. Never persisted. */
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(8_000),
      })
    )
    .min(1)
    .max(24)
    .refine((turns) => turns.at(-1)?.role === "user", "Last turn must be the user's question"),
  model: ChatModelSchema.optional(),
  effort: ChatEffortLevelSchema.optional(),
  zeroDataRetention: z.boolean().optional(),
});

/**
 * POST /api/chat/[id]/btw — answers a `/btw` side question against a compact snapshot of
 * thread `id`. No tools, no memory, nothing saved: the side thread lives only in the client
 * until it is closed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireLlmChatActor();

  if (gate.error != null) return gate.error;
  const { sbUserId, clerkUserId } = gate.data!;
  const { id: threadId } = await params;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return clientErrorResponse(400, "Invalid JSON");
  }

  const parsed = BtwRequestSchema.safeParse(json);

  if (!parsed.success) return clientErrorResponse(400, "Invalid body");

  const owner = await getThreadOwnerContext(threadId);

  if (owner.error || !owner.data) return clientErrorResponse(404, "Thread not found");
  if (owner.data.ownerId !== sbUserId) return clientErrorResponse(403, "Forbidden");

  const { messages: turns, model: requestedModel, effort } = parsed.data;
  const zeroDataRetention = parsed.data.zeroDataRetention === true;
  let selectedModel = requestedModel ? getChatModel(requestedModel) : DEFAULT_CHAT_MODEL;

  if (selectedModel.id === AUTO_CHAT_MODEL_ID) {
    selectedModel = resolveChatModel({
      modelId: selectedModel.id,
      draftText: turns.at(-1)!.text,
      experience: "arcadia",
      zeroDataRetention,
    });
  }

  // The client payload is not trusted to carry `adminOnly`; check the registry entry.
  if (ChatModels.find((m) => m.id === selectedModel.id)?.adminOnly) {
    if (!(await isAdminUser(clerkUserId))) selectedModel = DEFAULT_CHAT_MODEL;
  }

  const snapshot = await loadBtwContextSnapshot({
    loadSummary: async () => (await getConversationSummary(threadId)).data,
    loadMessages: async () => (await getMessages(threadId)).data,
  });

  logger.log("POST", "Answering side question", {
    model: selectedModel.id,
    snapshotTokens: snapshot.tokens,
    includedMessages: snapshot.includedMessages,
    totalMessages: snapshot.totalMessages,
    sideTurns: turns.length,
  });

  return runBtwStream({
    sbUserId,
    clerkUserId,
    modelId: selectedModel.id,
    effort,
    zeroDataRetention,
    snapshotText: snapshot.text,
    messages: turns.map((turn) => ({ role: turn.role, content: turn.text })),
  });
}

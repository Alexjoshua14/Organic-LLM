import { assembleMainChatContextBudget } from "@/lib/api/main-chat-context-budget";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { createLogger } from "@/lib/logger";
import { ContextBudgetRequestSchema } from "@/lib/schemas/context-budget";

const logger = createLogger("app/api/chat/context-budget/route.ts");

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ContextBudgetRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const authGate = await requireLlmChatActor();

  if (authGate.error != null) {
    return authGate.error;
  }

  const { sbUserId } = authGate.data!;

  try {
    const budget = await assembleMainChatContextBudget({
      logger,
      chatId: parsed.data.chatId,
      sbUserId,
      draftText: parsed.data.draftText ?? "",
      modelId: parsed.data.modelId,
      memoryEnabled: parsed.data.memory,
      webSearch: parsed.data.webSearch,
      messageSearch: parsed.data.messageSearch,
      knowledgeSearch: parsed.data.knowledgeSearch,
      experience: parsed.data.experience,
      chatStyle: parsed.data.chatStyle,
      speechFriendly: parsed.data.speechFriendly,
    });

    return Response.json({ budget });
  } catch (error) {
    logger.error("POST", "Failed to assemble context budget", {
      err: error instanceof Error ? error.message : String(error),
    });

    return Response.json({ error: "Failed to compute context budget" }, { status: 500 });
  }
}

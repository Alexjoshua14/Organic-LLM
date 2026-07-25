import { generateText, stepCountIs } from "ai";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { GENERIC_SERVER_ERROR, logRouteError } from "@/lib/api/client-safe-error";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import {
  GEN_UI_LAB_AION_SYSTEM,
  GEN_UI_LAB_MODEL,
  GenUiLabRequestSchema,
  actionsToApiResponse,
  buildGenUiLabPrompt,
  type GenUiLabAction,
} from "@/lib/sandbox/gen-ui-lab";
import { createGenUiLabToolKit } from "@/lib/sandbox/gen-ui-lab-tools";

export const maxDuration = 30;

const logger = createLogger("app/api/sandbox/gen-ui-lab/route.ts");

export async function POST(req: Request) {
  const gate = await requireLlmChatActor();

  if (gate.error != null) return gate.error;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = GenUiLabRequestSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten().formErrors.join(", ") || "Invalid request" },
      { status: 400 }
    );
  }

  const actions: GenUiLabAction[] = [];
  const tools = createGenUiLabToolKit(actions);
  const start = performance.now();

  try {
    const { text, usage } = await generateText({
      model: GEN_UI_LAB_MODEL,
      system: GEN_UI_LAB_AION_SYSTEM,
      prompt: buildGenUiLabPrompt(parsed.data),
      tools,
      stopWhen: stepCountIs(2),
      maxOutputTokens: 800,
    });

    recordLlmCall({
      model: GEN_UI_LAB_MODEL,
      usage,
      durationMs: performance.now() - start,
      metadata: { route: "/api/sandbox/gen-ui-lab", operation: `gen-ui-lab:${parsed.data.intent}` },
    });

    return Response.json(actionsToApiResponse(actions, text));
  } catch (err) {
    logRouteError(logger, "POST", err);

    return Response.json({ error: GENERIC_SERVER_ERROR }, { status: 500 });
  }
}

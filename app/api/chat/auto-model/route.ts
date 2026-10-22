import { z } from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import {
  USER_COMPOSER_ACTIVITY_STATES,
  routeAutoModel,
  type AutoModelRouteDecision,
} from "@/lib/llm/auto-model-router";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/api/chat/auto-model/route.ts");

export const AutoModelRouteRequestSchema = z.object({
  text: z.string().max(40_000).default(""),
  previousText: z.string().max(40_000).optional(),
  previousModelId: z.string().max(200).optional(),
  activityState: z.enum(USER_COMPOSER_ACTIVITY_STATES).optional().default("typing"),
  previousActivityState: z.enum(USER_COMPOSER_ACTIVITY_STATES).optional(),
  experience: z.string().max(64).optional(),
  webSearch: z.boolean().optional(),
  previousWebSearch: z.boolean().optional(),
  memory: z.boolean().optional(),
  previousMemory: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  useLiveLlm: z.boolean().optional().default(false),
});

export type AutoModelRouteRequest = z.infer<typeof AutoModelRouteRequestSchema>;

export async function POST(req: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AutoModelRouteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) {
    return authGate.error;
  }

  try {
    const hasGatewayKey = Boolean(process.env.AI_GATEWAY_API_KEY);
    const enableLiveLlm = Boolean(parsed.data.useLiveLlm && hasGatewayKey);

    const decision: AutoModelRouteDecision = await routeAutoModel(
      {
        text: parsed.data.text,
        previousText: parsed.data.previousText,
        previousModelId: parsed.data.previousModelId,
        activityState: parsed.data.activityState,
        previousActivityState: parsed.data.previousActivityState,
        experience: parsed.data.experience,
        webSearch: parsed.data.webSearch,
        previousWebSearch: parsed.data.previousWebSearch,
        memory: parsed.data.memory,
        previousMemory: parsed.data.previousMemory,
        hasAttachments: parsed.data.hasAttachments,
      },
      {
        useLiveJev: enableLiveLlm,
        useLivePicker: enableLiveLlm,
      }
    );

    return Response.json(decision, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Organic-ZDR": "true",
      },
    });
  } catch (error) {
    logger.warn("POST", "Auto-model route fallback on error", {
      err: error instanceof Error ? error.message : String(error),
    });

    const fallback = await routeAutoModel({
      text: parsed.data.text,
      previousText: parsed.data.previousText,
      previousModelId: parsed.data.previousModelId,
      activityState: parsed.data.activityState,
      experience: parsed.data.experience,
      webSearch: parsed.data.webSearch,
      memory: parsed.data.memory,
    });

    return Response.json(fallback, { status: 200 });
  }
}

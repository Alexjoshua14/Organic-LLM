import type { LlmChatActorData } from "@/lib/api/chat-llm-gate";
import type {
  AutoModelRouteDecision,
  AutoModelRouteInput,
  AutoPickerGenerateFn,
  JevGateGenerateFn,
  RouteAutoModelOptions,
} from "@/lib/llm/auto-model-router";
import type { Result } from "@/types";

import { z } from "zod";

import { USER_COMPOSER_ACTIVITY_STATES } from "@/lib/llm/auto-model-router";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/api/auto-model-handler.ts");

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

type AutoModelDeps = {
  /** Auth and rate limits only: the heuristic router makes no model call. */
  requireActor(): Promise<Result<LlmChatActorData, Response>>;
  /** The plan's weekly spend budget; only consulted before a live (spending) model call. */
  planBudgetAllows(actor: LlmChatActorData): Promise<boolean>;
  route(
    input: AutoModelRouteInput,
    options?: RouteAutoModelOptions
  ): Promise<AutoModelRouteDecision>;
  /** Live model calls. They re-check the budget and write usage to the ledger. */
  generateGate: JevGateGenerateFn;
  generatePicker: AutoPickerGenerateFn;
  hasGatewayKey(): boolean;
};

export function createAutoModelHandler(deps: AutoModelDeps) {
  return async function POST(req: Request): Promise<Response> {
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

    // An exhausted plan must not break the composer's model pill, so the budget is checked below
    // and only gates the live path.
    const authGate = await deps.requireActor();

    if (authGate.error != null) {
      return authGate.error;
    }

    try {
      let enableLiveLlm = Boolean(parsed.data.useLiveLlm && deps.hasGatewayKey());

      if (enableLiveLlm) {
        enableLiveLlm = await deps.planBudgetAllows(authGate.data!);
      }

      const decision: AutoModelRouteDecision = await deps.route(
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
        enableLiveLlm
          ? {
              useLiveJev: true,
              useLivePicker: true,
              generateGate: deps.generateGate,
              generatePicker: deps.generatePicker,
            }
          : {}
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

      const fallback = await deps.route({
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
  };
}

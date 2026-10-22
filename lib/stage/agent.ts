import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { models } from "@/lib/schemas/chat-models";
import { recordLlmCall } from "@/lib/llm/metrics";
import { StageRectSchema, type StageState } from "./schema";

const RESPONSE = z.object({
  reply: z.string().min(1).max(6000),
  summary: z.string().max(3000),
  designBrief: z.string().max(2000).nullable(),
  nextTier: z.enum(["fast", "balanced", "deep"]),
});

const DESIGN_UPSERT = z.object({
  operation: z.literal("upsert"),
  kind: z.enum(["note", "mermaid", "recipe", "chat"]),
  title: z.string().min(1).max(100),
  targetId: z.string().uuid().nullable(),
  rect: StageRectSchema.nullable(),
  text: z.string().max(4000).nullable(),
  code: z.string().max(8000).nullable(),
  ingredients: z.array(z.string().max(200)).max(40).nullable(),
  steps: z.array(z.string().max(1000)).max(30).nullable(),
});
export const DESIGN_PLAN = z.object({ operations: z.array(z.discriminatedUnion("operation", [
  DESIGN_UPSERT,
  z.object({ operation: z.literal("move"), targetId: z.string().uuid(), rect: StageRectSchema }),
  z.object({ operation: z.literal("remove"), targetId: z.string().uuid() }),
])).max(8) });
export type DesignPlan = z.infer<typeof DESIGN_PLAN>;

const MAIN_INSTRUCTIONS = `You are the single central Organic agent on a persistent 32×32 spatial stage. Answer the user directly and helpfully. Keep a concise cumulative summary of enduring context. You can ask a separate designer to add, update, move, or remove note, Mermaid diagram, recipe, and live chat widgets. In designBrief, state requested widget kinds and exact cell position and size if the user gives them; e.g. a chat 6 cells wide and 20 tall. Reserve the central Organic agent at x13 y11 w6 h8 with at least one empty cell around it and all widgets. Request design only when the stage would improve. Do not claim a widget has been placed before the designer finishes. Choose the next turn's cost tier: fast for straightforward chat, balanced for multi-step work, deep for genuinely difficult reasoning. Never disclose private reasoning.`;
const DESIGN_INSTRUCTIONS = `You are the stage layout designer. Produce a concrete operation plan for a 32×32 grid with x,y from 0 to 31 and w,h as cell spans. The central Organic agent owns x13 y11 w6 h8; keep at least one empty cell between every rectangle and the agent. Use the user's exact requested cell coordinates and dimensions when valid, including unusual shapes such as a chat w6 h20. Every operation can upsert content and an exact rect, move an unchanged existing widget, or remove one. For upsert, targetId null means create a new widget; a targetId means update the same kind and stable ID. For move/remove use an existing targetId. Never change a chat widget's thread identity. Give every new widget an exact rect when you can; null rect asks the server to find a position. Keep paper and ink clarity, quiet spacious groups, restrained chrome, and stable visual hierarchy. Prefer a few useful pieces over clutter and avoid unnecessary changes. Note text is plain text; Mermaid code is diagram source only. Recipe ingredients are short readable lines. Never include executable code, HTML, or arbitrary URLs. Return an empty operations array when no change helps.`;

export function modelForTier(tier: "fast" | "balanced" | "deep") {
  return tier === "deep" ? models.openai.flagship.id : tier === "balanced" ? models.openai.sol.id : models.openai.luna.id;
}

export function tierFromModel(model: string): "fast" | "balanced" | "deep" {
  return model === models.openai.flagship.id ? "deep" : model === models.openai.sol.id ? "balanced" : "fast";
}

function context(state: StageState, includeContent = false) {
  const widgets = state.widgets.map((widget) => ({ id: widget.id, kind: widget.kind, title: widget.title, rect: widget.rect, ...(includeContent && widget.kind === "note" ? { text: widget.text.slice(0, 1000) } : {}), ...(includeContent && widget.kind === "mermaid" ? { code: widget.code.slice(0, 1000) } : {}) }));
  return JSON.stringify({ widgets, summary: state.summary.slice(0, 3000), recentMessages: state.messages.slice(-12).map((message) => ({ ...message, text: message.text.slice(0, 1200) })) });
}

export class StageGenerationError extends Error {
  constructor(public model: string, public usage: { inputTokens: number; outputTokens: number } | null, cause: unknown) {
    super("Stage generation failed", { cause });
  }
}

export async function generateStageTurn(args: {
  ownerId: string; clerkUserId: string; state: StageState; message: string;
}) {
  const model = args.state.nextModel;
  const start = performance.now();
  const budget = createLlmBudgetHooks({ ownerId: args.ownerId, clerkUserId: args.clerkUserId, modelId: model, operation: "stage.turn", route: "/api/stage" });
  let observedUsage: { inputTokens: number; outputTokens: number } | null = null;
  try {
    const result = await generateText({
      ...budget,
      onStepFinish: async (step) => {
        observedUsage = { inputTokens: step.usage.inputTokens ?? 0, outputTokens: step.usage.outputTokens ?? 0 };
        await budget.onStepFinish(step);
      },
      model,
      instructions: MAIN_INSTRUCTIONS,
      prompt: `Current bounded stage context:\n${context(args.state)}\n\nNewest user message:\n${args.message}`,
      output: Output.object({ schema: RESPONSE }),
      maxOutputTokens: 1600,
      abortSignal: AbortSignal.timeout(100_000),
      providerOptions: { gateway: { zeroDataRetention: true } },
    });
    recordLlmCall({ persist: false, model, usage: result.usage, durationMs: performance.now() - start, metadata: { operation: "stage.turn", route: "/api/stage" } });
    return { ...result.output, model, usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    } };
  } catch (error) {
    recordLlmCall({ persist: false, model, usage: observedUsage, durationMs: performance.now() - start, metadata: { operation: "stage.turn", route: "/api/stage" } });
    throw new StageGenerationError(model, observedUsage, error);
  }
}

export async function generateStageDesign(args: {
  ownerId: string; clerkUserId: string; state: StageState; brief: string;
}) {
  const model = models.openai.sol.id;
  const start = performance.now();
  const budget = createLlmBudgetHooks({ ownerId: args.ownerId, clerkUserId: args.clerkUserId, modelId: model, operation: "stage.design", route: "/api/stage" });
  let observedUsage: { inputTokens: number; outputTokens: number } | null = null;
  try {
    const result = await generateText({
      ...budget,
      onStepFinish: async (step) => {
        observedUsage = { inputTokens: step.usage.inputTokens ?? 0, outputTokens: step.usage.outputTokens ?? 0 };
        await budget.onStepFinish(step);
      },
      model,
      instructions: DESIGN_INSTRUCTIONS,
      prompt: `Current bounded stage context:\n${context(args.state, true)}\n\nDesign brief:\n${args.brief}`,
      output: Output.object({ schema: DESIGN_PLAN }),
      maxOutputTokens: 3000,
      abortSignal: AbortSignal.timeout(60_000),
      providerOptions: { gateway: { zeroDataRetention: true } },
    });
    recordLlmCall({ persist: false, model, usage: result.usage, durationMs: performance.now() - start, metadata: { operation: "stage.design", route: "/api/stage" } });
    return { plan: result.output, model, usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 } };
  } catch (error) {
    recordLlmCall({ persist: false, model, usage: observedUsage, durationMs: performance.now() - start, metadata: { operation: "stage.design", route: "/api/stage" } });
    throw new StageGenerationError(model, observedUsage, error);
  }
}

import type { LanguageModelUsage } from "ai";

import { randomUUID } from "crypto";

import { generateObject } from "ai";
import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { z } from "zod";

import type {
  RoutedThought,
  ThoughtDisposition,
  ThoughtRoutingResult,
} from "@/lib/schemas/thought-routing";
import { ThoughtDispositionSchema } from "@/lib/schemas/thought-routing";

import {
  JEV_GATEWAY_MODEL_ID,
  ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS,
  jevRouterCallConfig,
  type JevZdrProviderOptions,
} from "@/lib/llm/subagents/orchestrator/router-zdr";
import { createLogger } from "@/lib/logger";
import { gatewayAttribution } from "@/lib/usage/gateway-attribution";

const logger = createLogger("lib/llm/subagents/orchestrator/thought-router");

export type ThoughtRouterWorker = {
  id: string;
  name: string;
  role: string;
  goal: string;
};

export type ThoughtRouterInput = {
  text: string;
  workers: ReadonlyArray<ThoughtRouterWorker>;
};

/**
 * Cheap intelligent router for multi-thought splits.
 * Implementations must force ZDR on any LLM call (see {@link ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS}).
 * Primary backend: catalog **Jev** (`openai/gpt-6-jev`).
 */
export type ThoughtRouter = {
  readonly modelId: string;
  /** Always true — contract for this path. */
  readonly zeroDataRetention: true;
  /** Gateway provider options that must be passed to any generate* call. */
  readonly providerOptions: JevZdrProviderOptions;
  route(input: ThoughtRouterInput): Promise<ThoughtRoutingResult>;
};

const DIRECT_HINT =
  /\b(what|why|how|when|where|who|can you|could you|did you|are you|is that|clarify|confirm|thanks|thank you|ok|okay|got it|hey|hi|hello|yo|sup|howdy|greetings)\b/i;
const GREETING_ONLY =
  /^(hey|hi|hello|yo|sup|howdy|greetings|good (morning|afternoon|evening)|thanks|thank you|ok|okay|got it)([!.?\s]*)$/i;
const TASK_HINT =
  /\b(research|implement|build|write|draft|code|find|search|analyze|summarize|plan|review|fix|investigate|create|generate)\b/i;

/** True when the orchestrator should answer this thought itself (not spawn/delegate). */
export function isOrchestratorDirectThought(thought: string): boolean {
  const trimmed = thought.trim();
  if (!trimmed) return true;

  if (GREETING_ONLY.test(trimmed)) return true;

  // Short conversational beats with no task verb — greetings, small talk, pings.
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 6 && trimmed.length <= 48 && !TASK_HINT.test(trimmed)) {
    return true;
  }

  if (trimmed.endsWith("?") && trimmed.length < 180) return true;

  return DIRECT_HINT.test(trimmed) && !TASK_HINT.test(trimmed) && trimmed.length < 220;
}

const JevRouteThoughtSchema = z.object({
  text: z.string().min(1),
  disposition: ThoughtDispositionSchema,
});

const JevRouteObjectSchema = z.object({
  thoughts: z.array(JevRouteThoughtSchema).min(1).max(12),
});

export type JevRouteGenerate = (args: {
  model: string;
  system: string;
  prompt: string;
  providerOptions: JevZdrProviderOptions;
  schema: typeof JevRouteObjectSchema;
}) => Promise<{
  object: z.infer<typeof JevRouteObjectSchema>;
  usage?: LanguageModelUsage;
  providerMetadata?: unknown;
}>;

function splitIntoThoughtTexts(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [text];

  const byBlank = trimmed
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  const lines = trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const bulletish = lines.filter((l) => /^(\d+[.)]\s+|[-*•]\s+)/.test(l));
  if (bulletish.length >= 2 && bulletish.length === lines.length) {
    return lines.map((l) => l.replace(/^(\d+[.)]\s+|[-*•]\s+)/, "").trim());
  }

  const alsoSplit = trimmed.split(/\s+Also,\s+/i);
  if (alsoSplit.length === 2 && alsoSplit.every((p) => p.trim().length > 12)) {
    return alsoSplit.map((p) => p.trim());
  }

  return [trimmed];
}

function scoreWorkerMatch(thought: string, worker: ThoughtRouterWorker): number {
  const hay = `${worker.name} ${worker.role} ${worker.goal}`.toLowerCase();
  const tokens = thought
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
  }
  if (
    hay.includes(worker.role.toLowerCase()) &&
    thought.toLowerCase().includes(worker.role.toLowerCase())
  ) {
    score += 3;
  }
  if (thought.toLowerCase().includes(worker.name.toLowerCase())) score += 5;

  return score;
}

function decideDisposition(
  thought: string,
  workers: ReadonlyArray<ThoughtRouterWorker>
): ThoughtDisposition {
  if (isOrchestratorDirectThought(thought)) {
    return { kind: "direct", reason: "short clarification or question for the orchestrator" };
  }

  let best: ThoughtRouterWorker | null = null;
  let bestScore = 0;
  for (const worker of workers) {
    const score = scoreWorkerMatch(thought, worker);
    if (score > bestScore) {
      bestScore = score;
      best = worker;
    }
  }

  if (best && bestScore >= 2) {
    return {
      kind: "existing_subagent",
      agentId: best.id,
      reason: `matched worker ${best.name} (${best.role}) by goal/role overlap`,
    };
  }

  const roleGuess = TASK_HINT.exec(thought)?.[1]?.toLowerCase() ?? "generalist";

  return {
    kind: "new_subagent",
    suggestedRole: roleGuess,
    reason: "no existing worker matched; spawn a dedicated worker for this section",
  };
}

/**
 * Reclaim greetings / short conversational pings that a model misrouted to a worker.
 * Only rewrites dispositions that are clearly orchestrator-owned; real tasks stay assigned.
 */
export function reclaimMisroutedDirectThoughts(
  thoughts: RoutedThought[]
): RoutedThought[] {
  return thoughts.map((thought) => {
    if (thought.disposition.kind === "direct") return thought;
    if (!isOrchestratorDirectThought(thought.text)) return thought;

    return {
      ...thought,
      disposition: {
        kind: "direct",
        reason: "reclaimed conversational ping for the orchestrator",
      },
    };
  });
}

function buildHeuristicResult(
  input: ThoughtRouterInput,
  fallback?: { reason: string }
): ThoughtRoutingResult {
  const parts = splitIntoThoughtTexts(input.text);
  const thoughts: RoutedThought[] = reclaimMisroutedDirectThoughts(
    parts.map((text) => ({
      thoughtId: randomUUID(),
      text,
      disposition: decideDisposition(text, input.workers),
    }))
  );

  return {
    sourceText: input.text,
    singleThought: thoughts.length === 1,
    thoughts,
    zeroDataRetention: true,
    routerModelId: JEV_GATEWAY_MODEL_ID,
    usedHeuristicFallback: Boolean(fallback),
    fallbackReason: fallback?.reason,
  };
}

/**
 * Deterministic fallback — only for when the Jev call throws, or explicit test injection.
 * When used after a Jev failure, set {@link ThoughtRoutingResult.usedHeuristicFallback}.
 */
export function createHeuristicThoughtRouter(options?: {
  /** Label results as a Jev failure fallback (default false for pure unit tests). */
  asFallback?: boolean;
  fallbackReason?: string;
}): ThoughtRouter {
  return {
    modelId: JEV_GATEWAY_MODEL_ID,
    zeroDataRetention: true,
    providerOptions: ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS,
    async route(input) {
      if (options?.asFallback) {
        return buildHeuristicResult(input, {
          reason: options.fallbackReason ?? "jev_call_failed",
        });
      }

      return {
        ...buildHeuristicResult(input),
        usedHeuristicFallback: false,
      };
    },
  };
}

function formatWorkersForPrompt(workers: ReadonlyArray<ThoughtRouterWorker>): string {
  if (workers.length === 0) return "(no existing workers)";

  return workers
    .map((w) => `- id=${w.id} name=${w.name} role=${w.role} goal=${w.goal}`)
    .join("\n");
}

const JEV_ROUTER_SYSTEM = `You are Jev, Organic LLM's cheap thought router for the orchestrator.
Split the user message into one or more distinct thoughts/sections.
For each thought, choose exactly one disposition:
- direct — short question, clarification, greeting, acknowledgment, or ordinary conversation the orchestrator should answer itself
- existing_subagent — assign to an existing worker (agentId must be one of the ids listed)
- new_subagent — spawn a worker; suggestedRole is a short role label (e.g. researcher, coder)

Rules:
- Prefer a single thought when the message is one idea.
- Greetings and small talk (e.g. "hey", "hi", "thanks") are always direct — never spawn a worker for them.
- Do not dump unrelated thoughts onto one worker.
- Keep reasons brief.
- Output structured data only.`;

const defaultJevGenerate: JevRouteGenerate = async (args) => {
  const result = await generateObject({
    model: args.model,
    instructions: args.system,
    prompt: args.prompt,
    schema: args.schema,
    providerOptions: args.providerOptions,
    maxOutputTokens: 800,
  });

  return { object: result.object, usage: result.usage, providerMetadata: result.providerMetadata };
};

export type CreateJevThoughtRouterOptions = {
  /** Injected for unit tests — must still receive ZDR provider options. */
  generate?: JevRouteGenerate;
  /** Owner of the turn: tags the Gateway request so its spend is attributable. */
  ownerId?: string;
  /** Called with token usage after a successful Jev call (usage dashboard). */
  onUsage?: (args: {
    modelId: string;
    usage?: LanguageModelUsage;
    providerMetadata?: unknown;
  }) => void | Promise<void>;
};

/**
 * Primary thought router: catalog Jev with mandatory AI Gateway ZDR.
 * On throw, falls back to the heuristic and labels {@link ThoughtRoutingResult.usedHeuristicFallback}.
 */
export function createJevThoughtRouter(options?: CreateJevThoughtRouterOptions): ThoughtRouter {
  const call = jevRouterCallConfig();
  const generate = options?.generate ?? defaultJevGenerate;

  return {
    modelId: call.model,
    zeroDataRetention: true,
    providerOptions: call.providerOptions,
    async route(input) {
      const prompt = [
        "Existing workers:",
        formatWorkersForPrompt(input.workers),
        "",
        "User message:",
        input.text,
      ].join("\n");

      const providerOptions: JevZdrProviderOptions = options?.ownerId
        ? {
            gateway: {
              ...call.providerOptions.gateway,
              ...gatewayAttribution({ userId: options.ownerId, operation: "multitask_router" }),
            },
          }
        : call.providerOptions;

      try {
        if (!options?.generate) {
          if (!options?.ownerId) throw new Error("Routing requires a verified owner");
          await createLlmBudgetHooks({ ownerId: options.ownerId, modelId: call.model, operation: "multitask_router" }).prepareStep();
        }
        const { object, usage, providerMetadata } = await generate({
          model: call.model,
          system: JEV_ROUTER_SYSTEM,
          prompt,
          providerOptions,
          schema: JevRouteObjectSchema,
        });

        if (providerOptions.gateway.zeroDataRetention !== true) {
          throw new Error("Jev routing refused: ZDR must be on");
        }

        await options?.onUsage?.({ modelId: call.model, usage, providerMetadata });

        const thoughts: RoutedThought[] = reclaimMisroutedDirectThoughts(
          object.thoughts.map((t) => ({
            thoughtId: randomUUID(),
            text: t.text.trim(),
            disposition: t.disposition,
          }))
        );

        return {
          sourceText: input.text,
          singleThought: thoughts.length === 1,
          thoughts,
          zeroDataRetention: true,
          routerModelId: call.model,
          usedHeuristicFallback: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("createJevThoughtRouter", `Jev failed; heuristic fallback: ${message}`);

        return buildHeuristicResult(input, {
          reason: `jev_call_failed: ${message}`,
        });
      }
    },
  };
}

/** Assert ZDR is forced on the router instance (unit tests). */
export function assertRouterForcesZdr(router: ThoughtRouter): boolean {
  return (
    router.zeroDataRetention === true &&
    router.providerOptions.gateway.zeroDataRetention === true
  );
}

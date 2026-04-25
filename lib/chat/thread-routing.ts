"use server";

import type { HomepageRouteCandidate } from "@/lib/chat/thread-routing-candidates";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { createChat } from "@/lib/chat/chat-store";
import { loadHomepageRoutingCandidates } from "@/lib/chat/load-homepage-routing-candidates";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { recordLlmCall } from "@/lib/llm/metrics";
import { createLogger } from "@/lib/logger";
import { Result } from "@/types";

const logger = createLogger("lib/chat/thread-routing.ts");

const ROUTING_MODEL = openai("gpt-5.4-nano");

const HomepageRoutingDecisionSchema = z.object({
  matchRouteKey: z
    .string()
    .nullable()
    .describe(
      "Exact routeKey from the candidate list (thread UUID or rabbit_hole:<sessionId>), or null if none fit"
    ),
});

export type HomepageRouteMetrics = {
  candidateCount: number;
  coalescenceMode: boolean;
  fetchCandidatesMs: number;
  classificationMs: number;
  totalServerMs: number;
  outcome: "match" | "new";
  matchedFeature?: string;
  createdNewThread: boolean;
};

export type RouteHomepagePromptData =
  | {
      outcome: "match";
      href: string;
      metrics: HomepageRouteMetrics;
    }
  | {
      outcome: "new";
      chatId: string;
      metrics: HomepageRouteMetrics;
    };

function truncateForPrompt(text: string, maxLen: number): string {
  const t = text.trim();

  if (t.length <= maxLen) return t;

  return `${t.slice(0, maxLen)}…`;
}

function buildClassifierPrompt(userMessage: string, candidates: HomepageRouteCandidate[]): string {
  const lines = candidates.map((c, i) => {
    const summary = c.summaryText ? truncateForPrompt(c.summaryText, 400) : "(no summary yet)";

    return [
      `[${i + 1}] routeKey=${c.routeKey}`,
      `kind=${c.kind}`,
      `feature=${c.feature}`,
      `title=${truncateForPrompt(c.title, 200)}`,
      `summary=${summary}`,
    ].join("\n");
  });

  return [
    "User message (what they want to talk about now):",
    truncateForPrompt(userMessage, 2000),
    "",
    "Candidates (pick at most one):",
    lines.join("\n\n"),
  ].join("\n");
}

const ROUTING_SYSTEM = `You route the user to an existing conversation when their message clearly continues the same topic as exactly one candidate.
Rules:
- Prefer matchRouteKey = null unless the fit is strong and unambiguous.
- matchRouteKey must be copied exactly from a candidate line (routeKey=...).
- Do not invent routeKeys.
- If several candidates could fit, return null.
- Use title and summary semantics; do not match on superficial word overlap alone.`;

/**
 * Server-side semantic routing for the homepage input: match an existing thread/session or create a new main chat.
 */
export async function routeHomepagePrompt(params: {
  prompt: string;
  coalescenceMode: boolean;
}): Promise<Result<RouteHomepagePromptData>> {
  const trimmed = params.prompt.trim();

  if (!trimmed) {
    return { data: null, error: new Error("Prompt is empty") };
  }

  const serverStart = performance.now();
  const fetchStart = performance.now();
  const candidatesRes = await loadHomepageRoutingCandidates(params.coalescenceMode);
  const fetchCandidatesMs = performance.now() - fetchStart;

  if (candidatesRes.error) {
    return { data: null, error: candidatesRes.error };
  }

  const candidates = candidatesRes.data ?? [];

  const baseMetrics = (): HomepageRouteMetrics => ({
    candidateCount: candidates.length,
    coalescenceMode: params.coalescenceMode,
    fetchCandidatesMs,
    classificationMs: 0,
    totalServerMs: 0,
    outcome: "new",
    createdNewThread: true,
  });

  if (candidates.length === 0) {
    const created = await createChat();

    if (created.error || created.data === null) {
      return {
        data: null,
        error: created.error ?? new Error("Failed to create chat"),
      };
    }

    const totalServerMs = performance.now() - serverStart;
    const metrics: HomepageRouteMetrics = {
      ...baseMetrics(),
      classificationMs: 0,
      totalServerMs,
      outcome: "new",
      createdNewThread: true,
    };

    logger.log(
      "routeHomepagePrompt",
      JSON.stringify({
        event: "homepage_route_complete",
        reason: "no_candidates",
        ...metrics,
      })
    );

    return {
      data: {
        outcome: "new",
        chatId: created.data,
        metrics,
      },
      error: null,
    };
  }

  const validKeys = new Set(candidates.map((c) => c.routeKey));
  let classificationMs = 0;
  let matchRouteKey: string | null = null;

  const llmStart = performance.now();

  try {
    const { object, usage } = await generateObject({
      model: ROUTING_MODEL,
      system: ROUTING_SYSTEM,
      prompt: buildClassifierPrompt(trimmed, candidates),
      schema: HomepageRoutingDecisionSchema,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
      temperature: 0,
    });

    classificationMs = performance.now() - llmStart;

    recordLlmCall({
      model: "gpt-5.4-nano",
      usage,
      durationMs: classificationMs,
      metadata: { operation: "homepage-thread-routing" },
    });

    const key = object.matchRouteKey?.trim() ?? null;

    if (key && validKeys.has(key)) {
      matchRouteKey = key;
    } else if (key) {
      logger.log("routeHomepagePrompt", `Classifier returned unknown routeKey=${key}`);
    }
  } catch (e) {
    classificationMs = performance.now() - llmStart;
    logger.error(
      "routeHomepagePrompt",
      `Classification failed: ${e instanceof Error ? e.message : String(e)}`
    );
    matchRouteKey = null;
  }

  if (matchRouteKey) {
    const hit = candidates.find((c) => c.routeKey === matchRouteKey);
    const totalServerMs = performance.now() - serverStart;

    if (hit) {
      const metrics: HomepageRouteMetrics = {
        candidateCount: candidates.length,
        coalescenceMode: params.coalescenceMode,
        fetchCandidatesMs,
        classificationMs,
        totalServerMs,
        outcome: "match",
        matchedFeature: hit.feature,
        createdNewThread: false,
      };

      logger.log(
        "routeHomepagePrompt",
        JSON.stringify({
          event: "homepage_route_complete",
          routeKey: hit.routeKey,
          kind: hit.kind,
          feature: hit.feature,
          ...metrics,
        })
      );

      return {
        data: {
          outcome: "match",
          href: hit.href,
          metrics,
        },
        error: null,
      };
    }
  }

  const created = await createChat();

  if (created.error || created.data === null) {
    return {
      data: null,
      error: created.error ?? new Error("Failed to create chat"),
    };
  }

  const totalServerMs = performance.now() - serverStart;
  const metrics: HomepageRouteMetrics = {
    candidateCount: candidates.length,
    coalescenceMode: params.coalescenceMode,
    fetchCandidatesMs,
    classificationMs,
    totalServerMs,
    outcome: "new",
    createdNewThread: true,
  };

  logger.log(
    "routeHomepagePrompt",
    JSON.stringify({
      event: "homepage_route_complete",
      reason: matchRouteKey ? "invalid_match" : "no_match",
      ...metrics,
    })
  );

  return {
    data: {
      outcome: "new",
      chatId: created.data,
      metrics,
    },
    error: null,
  };
}

"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { createChat } from "@/lib/chat/chat-store";
import type {
  HomepageRouteCandidate,
  HomepageRouteCandidateKind,
} from "@/lib/chat/thread-routing-candidates";
import { resolveHomepageCandidateByIndex } from "@/lib/chat/thread-routing-candidates";
import { loadHomepageRoutingCandidates } from "@/lib/chat/load-homepage-routing-candidates";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { recordLlmCall } from "@/lib/llm/metrics";
import { createLogger } from "@/lib/logger";
import { Result } from "@/types";

const logger = createLogger("lib/chat/thread-routing.ts");

const ROUTING_MODEL = openai("gpt-5.4-nano");

const HomepageRoutingDecisionSchema = z.object({
  selectedCandidateIndex: z
    .number()
    .int()
    .nullable()
    .describe(
      "0-based index of exactly one candidate from the numbered list [0]..[n-1], or null if none clearly fit"
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
  /** Set when outcome is match; used client-side for draft= query behavior. */
  matchedKind?: HomepageRouteCandidateKind;
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
      `[${i}] kind=${c.kind}`,
      `feature=${c.feature}`,
      `title=${truncateForPrompt(c.title, 200)}`,
      `summary=${summary}`,
    ].join("\n");
  });

  return [
    "User message (what they want to talk about now):",
    truncateForPrompt(userMessage, 2000),
    "",
    "Candidates (pick at most one by index):",
    lines.join("\n\n"),
  ].join("\n");
}

const ROUTING_SYSTEM = `You route the user to an existing conversation or workspace page when their message clearly continues the same topic as exactly one candidate.
Rules:
- Reply with selectedCandidateIndex = null unless the fit is strong and unambiguous.
- selectedCandidateIndex must be an integer between 0 and n-1 inclusive, matching the [i] label of one candidate line, or null.
- If several candidates could fit, return null.
- Use title and summary semantics; do not match on superficial word overlap alone.
- kind=strata_page is a Strata workspace page; kind=thread is a chat thread; kind=rabbit_hole is a rabbit-hole session.`;

/**
 * Server-side semantic routing for the homepage input: match an existing thread/session/page or create a new main chat.
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

  let classificationMs = 0;
  let hit: HomepageRouteCandidate | null = null;

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

    hit = resolveHomepageCandidateByIndex(candidates, object.selectedCandidateIndex);

    if (object.selectedCandidateIndex != null && !hit) {
      logger.log(
        "routeHomepagePrompt",
        `Classifier returned out-of-range index=${object.selectedCandidateIndex} (len=${candidates.length})`
      );
    }
  } catch (e) {
    classificationMs = performance.now() - llmStart;
    logger.error(
      "routeHomepagePrompt",
      `Classification failed: ${e instanceof Error ? e.message : String(e)}`
    );
    hit = null;
  }

  if (hit) {
    const totalServerMs = performance.now() - serverStart;

    const metrics: HomepageRouteMetrics = {
      candidateCount: candidates.length,
      coalescenceMode: params.coalescenceMode,
      fetchCandidatesMs,
      classificationMs,
      totalServerMs,
      outcome: "match",
      matchedFeature: hit.feature,
      matchedKind: hit.kind,
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
      reason: "no_match",
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

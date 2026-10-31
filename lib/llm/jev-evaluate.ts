import "server-only";

import { z } from "zod";

import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { Result } from "@/types";

const logger = createLogger("lib/llm/jev-evaluate.ts");

/**
 * TypeSafe's Jev: a decision-only model that answers typed questions about a piece of state with
 * calibrated probabilities instead of text. Reached only through AI Gateway's `/v1/evaluate` over
 * plain HTTP — AI SDK's `experimental_evaluate` needs AI SDK 7 and this repo is on 5.
 *
 * Every request carries {@link JEV_PROVIDER_OPTIONS}. There is no parameter that removes it: Jev
 * is called with zero data retention or not at all. TypeSafe is on the Gateway's ZDR provider
 * list; when ZDR routing is unavailable the Gateway fails the request instead of falling back.
 */
export const JEV_MODEL_ID = "typesafe-ai/jev";

const GATEWAY_EVALUATE_URL = "https://ai-gateway.vercel.sh/v1/evaluate";

/** Sent on every Jev request. `only` keeps the Gateway from routing the request anywhere else. */
export const JEV_PROVIDER_OPTIONS = {
  gateway: { zeroDataRetention: true, only: ["typesafe-ai"] },
} as const;

/** TypeSafe limits: a choice question takes at most 255 options; a score takes 2–10 levels. */
export const JEV_CHOICE_MAX_OPTIONS = 255;
export const JEV_SCORE_MIN_LEVELS = 2;
export const JEV_SCORE_MAX_LEVELS = 10;

/**
 * Jev's context limit is 32k tokens for the state plus the longest question, and 64k for the
 * state plus every question together. Callers budget against these; they are not enforced here.
 */
export const JEV_STATE_TOKEN_LIMIT = 32_000;
export const JEV_REQUEST_TOKEN_LIMIT = 64_000;

/** Yes/no; Jev answers with P(yes). Phrase it so "yes" is the actionable outcome. */
export type JevBooleanQuestion = {
  type: "boolean";
  instructions: string;
  criteria?: { true: string; false: string };
};

/** Pick one option. `criteria` maps option name → description (or null). */
export type JevChoiceQuestion<O extends string = string> = {
  type: "choice";
  instructions: string;
  criteria: Record<O, string | null>;
};

/** Rate along an ordered scale, lowest first. */
export type JevScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: readonly string[];
};

export type JevQuestion = JevBooleanQuestion | JevChoiceQuestion | JevScoreQuestion;

export type JevQuestionSet = Record<string, JevQuestion>;

export type JevBooleanAnswer = { type: "boolean"; probability: number };

export type JevChoiceAnswer<O extends string = string> = {
  type: "choice";
  choice: O;
  probabilities: Record<O, number>;
  /** 0–1. From the Gateway when present, else `(n · top − 1) / (n − 1)` per TypeSafe. */
  confidence: number;
};

export type JevScoreAnswer = {
  type: "score";
  /** Interpolated rung index, 0 = first criterion. */
  score: number;
  /** Keyed by rung index as a string ("0", "1", …). */
  probabilities: Record<string, number>;
  confidence: number | null;
};

export type JevAnswerFor<Q extends JevQuestion> = Q extends JevBooleanQuestion
  ? JevBooleanAnswer
  : Q extends JevChoiceQuestion<infer O>
    ? JevChoiceAnswer<O>
    : Q extends JevScoreQuestion
      ? JevScoreAnswer
      : never;

export type JevEvaluation<Q extends JevQuestionSet> = {
  answers: { [K in keyof Q]: JevAnswerFor<Q[K]> };
  durationMs: number;
  usage: { inputTokens?: number; outputTokens?: number } | null;
};

const ProbabilitySchema = z.number().min(0).max(1);

const AnswerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("boolean"), probability: ProbabilitySchema }),
  z.object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), ProbabilitySchema),
    confidence: ProbabilitySchema.optional(),
  }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    probabilities: z.record(z.string(), ProbabilitySchema),
    confidence: ProbabilitySchema.optional(),
  }),
]);

const EvaluateResponseSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
    })
    .optional(),
});

/**
 * Same credential order as `@ai-sdk/gateway`: API key, then the Vercel OIDC token.
 * `@ai-sdk/gateway` also reads OIDC from the request context via `@vercel/oidc`; that package is
 * not a direct dependency here, so deployments that rely on it need `AI_GATEWAY_API_KEY` set.
 */
function getGatewayBearerToken(): string | null {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;
}

export function hasJevCredentials(): boolean {
  return getGatewayBearerToken() !== null;
}

/** TypeSafe's choice confidence: how far the top option stands above a uniform spread. */
export function choiceConfidence(probabilities: Record<string, number>): number {
  const values = Object.values(probabilities);
  const n = values.length;

  if (n < 2) return n === 1 ? 1 : 0;

  const top = Math.max(...values);

  return Math.min(1, Math.max(0, (n * top - 1) / (n - 1)));
}

/** Returns a reason when a question would be rejected by TypeSafe, so we never send it. */
export function validateJevQuestion(question: JevQuestion): string | null {
  if (!question.instructions.trim()) return "empty instructions";

  if (question.type === "choice") {
    const count = Object.keys(question.criteria).length;

    if (count < 2) return "a choice needs at least 2 options";
    if (count > JEV_CHOICE_MAX_OPTIONS) {
      return `a choice takes at most ${JEV_CHOICE_MAX_OPTIONS} options (got ${count})`;
    }
  }

  if (question.type === "score") {
    const levels = question.criteria.length;

    if (levels < JEV_SCORE_MIN_LEVELS || levels > JEV_SCORE_MAX_LEVELS) {
      return `a score takes ${JEV_SCORE_MIN_LEVELS}–${JEV_SCORE_MAX_LEVELS} levels (got ${levels})`;
    }
  }

  return null;
}

function parseAnswer(question: JevQuestion, raw: unknown): JevBooleanAnswer | JevChoiceAnswer | JevScoreAnswer | null {
  const parsed = AnswerSchema.safeParse(raw);

  if (!parsed.success || parsed.data.type !== question.type) return null;

  const answer = parsed.data;

  if (answer.type === "boolean") return answer;

  if (answer.type === "choice" && question.type === "choice") {
    const options = Object.keys(question.criteria);

    if (!options.includes(answer.choice)) return null;

    const probabilities: Record<string, number> = {};

    for (const option of options) probabilities[option] = answer.probabilities[option] ?? 0;

    return {
      type: "choice",
      choice: answer.choice,
      probabilities,
      confidence: answer.confidence ?? choiceConfidence(probabilities),
    };
  }

  if (answer.type === "score") {
    return {
      type: "score",
      score: answer.score,
      probabilities: answer.probabilities,
      confidence: answer.confidence ?? null,
    };
  }

  return null;
}

/**
 * One Jev evaluation: every question answered against the same state in one round trip.
 * Never throws. Fails (with an error) on missing credentials, a question TypeSafe would reject,
 * timeout or abort, non-2xx, or an answer that doesn't match its question.
 */
export async function evaluateWithJev<Q extends JevQuestionSet>(params: {
  state: unknown;
  questions: Q;
  timeoutMs: number;
  /** Aborts the request early, e.g. when a caller's deadline passes. */
  signal?: AbortSignal;
  /** Logged with usage; never include user content. */
  metadata: { operation: string };
  /** Test seam. */
  fetchImpl?: typeof fetch;
}): Promise<Result<JevEvaluation<Q>>> {
  const token = getGatewayBearerToken();

  if (!token) {
    return { data: null, error: new Error("No AI Gateway credentials for Jev") };
  }

  for (const [key, question] of Object.entries(params.questions)) {
    const problem = validateJevQuestion(question);

    if (problem) {
      return { data: null, error: new Error(`Jev question ${key} rejected: ${problem}`) };
    }
  }

  const start = performance.now();
  const timeoutSignal = AbortSignal.timeout(params.timeoutMs);
  const signal = params.signal ? AbortSignal.any([params.signal, timeoutSignal]) : timeoutSignal;

  try {
    const response = await (params.fetchImpl ?? fetch)(GATEWAY_EVALUATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: JEV_MODEL_ID,
        state: params.state,
        questions: params.questions,
        providerOptions: JEV_PROVIDER_OPTIONS,
      }),
      signal,
    });

    if (!response.ok) {
      // Error bodies can echo request fields; log only the status and the error type.
      const body = (await response.json().catch(() => null)) as {
        type?: string;
        error?: { type?: string };
      } | null;
      const errorType = body?.type ?? body?.error?.type ?? "unknown";

      return {
        data: null,
        error: new Error(`Jev evaluate failed: ${response.status} ${errorType}`),
      };
    }

    const parsed = EvaluateResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      return { data: null, error: new Error("Jev evaluate returned an unexpected shape") };
    }

    const answers = {} as Record<string, unknown>;

    for (const [key, question] of Object.entries(params.questions)) {
      const answer = parseAnswer(question, parsed.data.answers[key]);

      if (!answer) {
        return { data: null, error: new Error(`Jev evaluate returned no usable answer: ${key}`) };
      }
      answers[key] = answer;
    }

    const durationMs = performance.now() - start;

    recordLlmCall({
      model: JEV_MODEL_ID,
      usage: parsed.data.usage,
      durationMs,
      metadata: params.metadata,
    });

    return {
      data: {
        answers: answers as JevEvaluation<Q>["answers"],
        durationMs,
        usage: parsed.data.usage ?? null,
      },
      error: null,
    };
  } catch (err) {
    const aborted = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    const message = aborted
      ? timeoutSignal.aborted
        ? `timed out after ${params.timeoutMs}ms`
        : "aborted"
      : err instanceof Error
        ? err.message
        : String(err);

    if (!aborted) {
      logger.warn("evaluateWithJev", `Jev evaluate threw: ${message}`);
    }

    return { data: null, error: new Error(`Jev evaluate ${message}`) };
  }
}

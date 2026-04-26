import type { GatewayModelId } from "@ai-sdk/gateway";
import { generateText, type UIMessage } from "ai";
import { z } from "zod";

import { getMessageText } from "@/lib/arcadia/help-response";
import { createLogger } from "@/lib/logger";
import type { MemoryItemType } from "@/lib/schemas/memory";

const logger = createLogger("lib/memory/query-rewriter.ts");

const DEFAULT_REWRITE_MODEL: GatewayModelId = "openai/gpt-5.4-nano";
const DEFAULT_TIMEOUT_MS = 800;
const TRANSCRIPT_MAX_CHARS = 500;
const MAX_QUERIES = 3;

const PRONOUN_PATTERN =
  /\b(it|this|that|these|those|them|they|their|there|here|he|she|him|her|we|us|our|you|your)\b/i;

const CLEAR_QUESTION = /^(what|how|why|when|where|who|which)\b/i;

const RewriterOutputSchema = z.object({
  queries: z.array(z.string()).min(1).max(MAX_QUERIES),
  rationale: z.string().optional(),
});

export type RewriteMemoryQueryOpts = {
  modelId?: GatewayModelId;
  timeoutMs?: number;
  /** When false, skip LLM rewrite. When undefined, use env ARCADIA_QUERY_REWRITE_ENABLED. */
  enabled?: boolean;
  /** Test-only: replace real generateText (same call signature as `ai` generateText). */
  generateTextImpl?: (options: Parameters<typeof generateText>[0]) => ReturnType<typeof generateText>;
};

export type RewriteMemoryQueryResult = {
  queries: string[];
  usedRewrite: boolean;
  rationale?: string;
};

export function isArcadiaQueryRewriteEnabled(): boolean {
  const v = process.env.ARCADIA_QUERY_REWRITE_ENABLED;

  if (v === undefined || v === "") return true;
  const s = v.trim().toLowerCase();

  return s !== "0" && s !== "false" && s !== "no" && s !== "off";
}

function wordCount(text: string): number {
  const t = text.trim();

  if (!t) return 0;

  return t.split(/\s+/).length;
}

export function hasPronounToken(rawQuery: string): boolean {
  return PRONOUN_PATTERN.test(rawQuery);
}

/** True when we should skip LLM and use [rawQuery] only (heuristics). */
export function shouldShortCircuitMemoryRewrite(
  rawQuery: string,
  recentMessages: UIMessage[]
): boolean {
  const q = rawQuery.trim();

  if (!q) return true;
  if (recentMessages.length < 2) return true;

  const wc = wordCount(q);

  if (wc < 4 && !hasPronounToken(q)) return true;

  if (CLEAR_QUESTION.test(q) && wc >= 6) return true;

  return false;
}

function scoreValue(score: number | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return Number.NEGATIVE_INFINITY;

  return score;
}

/**
 * Merge multiple Mem0 result batches by memory id, keeping the row with the highest score.
 */
export function mergeMemorySearchResultsByMaxScore(batches: MemoryItemType[][]): MemoryItemType[] {
  const byId = new Map<string, MemoryItemType>();

  for (const batch of batches) {
    for (const item of batch) {
      const id = item.id;
      const prev = byId.get(id);
      const sNew = scoreValue(item.score);
      const sOld = prev ? scoreValue(prev.score) : Number.NEGATIVE_INFINITY;

      if (!prev || sNew > sOld) {
        byId.set(id, item);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => scoreValue(b.score) - scoreValue(a.score));
}

function truncate(s: string, max: number): string {
  const t = s.trim();

  if (t.length <= max) return t;

  return `${t.slice(0, max)}…`;
}

function formatTranscript(recentMessages: UIMessage[]): string {
  return recentMessages
    .map((m) => {
      const role = m.role === "user" || m.role === "assistant" ? m.role : m.role;
      const text = truncate(getMessageText(m), TRANSCRIPT_MAX_CHARS);

      return `${role}: ${text}`;
    })
    .join("\n---\n");
}

export function parseRewriterJson(text: string): { queries: string[]; rationale?: string } | null {
  const trimmed = text.trim();
  let jsonStr = trimmed;

  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);

  if (fence) {
    jsonStr = fence[1]!.trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    const r = RewriterOutputSchema.safeParse(parsed);

    if (!r.success) return null;

    return { queries: r.data.queries, rationale: r.data.rationale };
  } catch {
    return null;
  }
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const q of queries) {
    const t = q.trim();

    if (!t) continue;
    const key = t.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_QUERIES) break;
  }

  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("rewrite_timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

const REWRITER_SYSTEM = `You rewrite a user's latest text into 1–3 short, standalone search queries for a personal memory database (vector search).
Rules:
- Each query must be self-contained: expand pronouns and vague references using the conversation transcript.
- No "this/that/it" without a clear noun the transcript supports.
- Prefer concrete entities, topics, names, projects, and preferences.
- Output ONLY valid JSON on a single line or in a json code block, no other prose.
Schema: {"queries": string[], "rationale"?: string}
- queries: 1 to 3 strings, each under 200 characters.`;

/**
 * Build up to the last 4 history messages plus the current user message (deduped by id).
 */
export function buildRecentTurnsForMemoryRewrite(
  history: UIMessage[],
  currentUserMessage: UIMessage
): UIMessage[] {
  const tail = history.slice(-4);
  const curId = currentUserMessage.id;
  const last = tail[tail.length - 1];

  if (last && curId && last.id === curId) {
    return tail;
  }

  return [...tail, currentUserMessage].slice(-5);
}

/**
 * Produce 1–3 standalone search strings for Mem0 only.
 * Callers must use {@link RewriteMemoryQueryResult.queries} exclusively for memory retrieval;
 * they must never replace or rewrite the user's {@link UIMessage} or any message sent to the main chat model.
 */
export async function rewriteMemoryQuery(
  rawQuery: string,
  recentMessages: UIMessage[],
  opts?: RewriteMemoryQueryOpts
): Promise<RewriteMemoryQueryResult> {
  const trimmed = rawQuery.trim();
  const enabled = opts?.enabled ?? isArcadiaQueryRewriteEnabled();

  if (!enabled) {
    return { queries: trimmed ? [trimmed] : [""], usedRewrite: false };
  }

  if (!trimmed) {
    return { queries: [""], usedRewrite: false };
  }

  if (shouldShortCircuitMemoryRewrite(trimmed, recentMessages)) {
    return { queries: [trimmed], usedRewrite: false };
  }

  const modelId = opts?.modelId ?? DEFAULT_REWRITE_MODEL;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const gen = opts?.generateTextImpl ?? generateText;
  const transcript = formatTranscript(recentMessages);
  const userPrompt = `Conversation (most recent last):\n${transcript}\n\nLatest user message to ground:\n${trimmed}\n\nProduce JSON with 1–3 retrieval queries.`;

  const started = performance.now();

  try {
    const result = await withTimeout(
      gen({
        model: modelId,
        system: REWRITER_SYSTEM,
        prompt: userPrompt,
        maxOutputTokens: 400,
      }),
      timeoutMs
    );

    const elapsed = performance.now() - started;
    const parsed = parseRewriterJson(result.text);
    const queries = parsed ? dedupeQueries(parsed.queries) : [];

    if (queries.length === 0) {
      logger.log("rewriteMemoryQuery", "parse_empty_fallback", { rawQuery: trimmed, elapsedMs: elapsed });

      return { queries: [trimmed], usedRewrite: false };
    }

    logger.log("rewriteMemoryQuery", "ok", {
      rawQuery: trimmed,
      queries,
      elapsedMs: elapsed,
      rationale: parsed?.rationale,
    });

    return {
      queries,
      usedRewrite: true,
      rationale: parsed?.rationale,
    };
  } catch (e) {
    const elapsed = performance.now() - started;
    const reason = e instanceof Error ? e.message : String(e);

    logger.warn("rewriteMemoryQuery", `fallback: ${reason}`, {
      rawQuery: trimmed,
      elapsedMs: elapsed,
    });

    return { queries: [trimmed], usedRewrite: false };
  }
}

/**
 * Typed memory retrieval planner for Arcadia context effort (Quick / Heavy).
 *
 * Emits up to three **slot** queries (entity, topic, preference) instead of
 * paraphrases of the whole sentence. Instant never calls this.
 *
 * Contract matches {@link rewriteMemoryQuery}: output is search strings only;
 * never substitute into the user's chat message.
 */
import type { GatewayModelId } from "@ai-sdk/gateway";
import type { UIMessage } from "ai";

import { generateText } from "ai";
import { z } from "zod";

import { getMessageText } from "@/lib/arcadia/help-response";
import { createLogger } from "@/lib/logger";
import { models } from "@/lib/schemas/chat-models";

const logger = createLogger("lib/memory/query-planner.ts");

const DEFAULT_PLANNER_MODEL: GatewayModelId = models.openai.luna.id as GatewayModelId;
const DEFAULT_TIMEOUT_MS = 350;
const TRANSCRIPT_MAX_CHARS = 500;
const SLOT_MAX_CHARS = 200;

const PlannerOutputSchema = z.object({
  entity: z.string().max(SLOT_MAX_CHARS).optional(),
  topic: z.string().max(SLOT_MAX_CHARS).optional(),
  preference: z.string().max(SLOT_MAX_CHARS).optional(),
  rationale: z.string().optional(),
});

export type MemoryPlanSlots = {
  entity?: string;
  topic?: string;
  preference?: string;
};

export type PlanMemoryQueriesOpts = {
  modelId?: GatewayModelId;
  timeoutMs?: number;
  generateTextImpl?: (
    options: Parameters<typeof generateText>[0]
  ) => ReturnType<typeof generateText>;
};

export type PlanMemoryQueriesResult = {
  slots: MemoryPlanSlots;
  queries: string[];
  usedPlan: boolean;
  rationale?: string;
};

function truncate(s: string, max: number): string {
  const t = s.trim();

  if (t.length <= max) return t;

  return `${t.slice(0, max)}…`;
}

function formatTranscript(recentMessages: UIMessage[]): string {
  return recentMessages
    .map((m) => {
      const text = truncate(getMessageText(m), TRANSCRIPT_MAX_CHARS);

      return `${m.role}: ${text}`;
    })
    .join("\n---\n");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("planner_timeout")), ms);

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

function cleanSlot(value: string | undefined): string | undefined {
  const t = value?.trim();

  if (!t) return undefined;

  return t.slice(0, SLOT_MAX_CHARS);
}

/** Parse planner JSON (raw or fenced). Empty / invalid → null. */
export function parsePlannerJson(text: string): (MemoryPlanSlots & { rationale?: string }) | null {
  const trimmed = text.trim();
  let jsonStr = trimmed;
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);

  if (fence) {
    jsonStr = fence[1]!.trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    const r = PlannerOutputSchema.safeParse(parsed);

    if (!r.success) return null;

    const entity = cleanSlot(r.data.entity);
    const topic = cleanSlot(r.data.topic);
    const preference = cleanSlot(r.data.preference);

    if (!entity && !topic && !preference) return null;

    return {
      entity,
      topic,
      preference,
      rationale: r.data.rationale,
    };
  } catch {
    return null;
  }
}

export function queriesFromPlan(slots: MemoryPlanSlots, rawQuery: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const q of [slots.entity, slots.topic, slots.preference]) {
    const t = q?.trim();

    if (!t) continue;
    const key = t.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }

  if (out.length === 0) {
    const fallback = rawQuery.trim();

    return fallback ? [fallback] : [];
  }

  return out;
}

/**
 * Extra Mem0 query for Heavy: resolved entity + topic when the entity name is
 * not already in the user's sentence.
 */
export function secondPassQuery(slots: MemoryPlanSlots, rawQuery: string): string | null {
  const entity = slots.entity?.trim();

  if (!entity) return null;

  if (rawQuery.toLowerCase().includes(entity.toLowerCase())) return null;

  const topic = slots.topic?.trim();
  const q = topic ? `${entity} ${topic}` : entity;

  return q.trim() || null;
}

const PLANNER_SYSTEM = `You plan vector searches over a personal memory store for one user message.
Fill only the slots that help retrieval. Do not paraphrase the whole sentence into similar queries.

Slots:
- entity: the concrete project, person, product, or thing referred to (resolve "my flagship project", "it", "that").
- topic: the asked-about facet (roadmap, status, decision, recipe, …).
- preference: ONLY if the user is asking about format, length, tone, or how they like answers. Omit for ordinary questions. Do not fill this because they said "I'm curious" or "tell me about".

Rules:
- Prefer names from the transcript over pronouns.
- Never emit a query for curiosity/intent phrasing ("I'm curious about", "can you explain").
- Output ONLY valid JSON. Schema: {"entity"?: string, "topic"?: string, "preference"?: string, "rationale"?: string}
- Each string under 200 characters. Omit unused slots.`;

/**
 * Produce 0–3 slot search strings for Mem0. Fail-open to `[rawQuery]`.
 */
export async function planMemoryQueries(
  rawQuery: string,
  recentMessages: UIMessage[],
  opts?: PlanMemoryQueriesOpts
): Promise<PlanMemoryQueriesResult> {
  const trimmed = rawQuery.trim();

  if (!trimmed) {
    return { slots: {}, queries: [], usedPlan: false };
  }

  const modelId = opts?.modelId ?? DEFAULT_PLANNER_MODEL;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const gen = opts?.generateTextImpl ?? generateText;
  const transcript = formatTranscript(recentMessages);
  const userPrompt = `Conversation (most recent last):\n${transcript}\n\nLatest user message:\n${trimmed}\n\nProduce JSON slots for memory search.`;
  const started = performance.now();

  try {
    const result = await withTimeout(
      gen({
        model: modelId,
        system: PLANNER_SYSTEM,
        prompt: userPrompt,
        maxOutputTokens: 400,
      }),
      timeoutMs
    );

    const elapsed = performance.now() - started;
    const parsed = parsePlannerJson(result.text);

    if (!parsed) {
      logger.log("planMemoryQueries", "parse_empty_fallback", {
        rawQueryLength: trimmed.length,
        elapsedMs: elapsed,
      });

      return { slots: {}, queries: [trimmed], usedPlan: false };
    }

    const { rationale, ...slots } = parsed;
    const queries = queriesFromPlan(slots, trimmed);

    logger.log("planMemoryQueries", "ok", {
      rawQueryLength: trimmed.length,
      queryCount: queries.length,
      slots: Object.keys(slots).filter((k) => slots[k as keyof MemoryPlanSlots]),
      elapsedMs: elapsed,
    });

    return { slots, queries, usedPlan: true, rationale };
  } catch (e) {
    const elapsed = performance.now() - started;
    const reason = e instanceof Error ? e.message : String(e);

    logger.warn("planMemoryQueries", `fallback: ${reason}`, {
      rawQueryLength: trimmed.length,
      elapsedMs: elapsed,
    });

    return { slots: {}, queries: [trimmed], usedPlan: false };
  }
}

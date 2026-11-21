import type { JevStageContextManifest, JevStageContextSegment } from "./schema";

import { getModelCost } from "@/lib/rate-limit/llm-cost";

/**
 * Context manifests for the insight's Context tab (COA-755): what each model hop was sent, in
 * prompt order, with a token estimate per segment, plus the per-hop cost breakdown. Manifests
 * live only in the prototype's own encrypted Redis record and the turn's NDJSON stream; they are
 * never sent to analytics or logs.
 */

/** Longest stored text per segment (and per tool output). */
export const JEV_CONTEXT_SEGMENT_CHARS = 4000;

/** Preview length on a collapsed segment row. */
export const JEV_CONTEXT_PREVIEW_CHARS = 120;

/** Same rough estimate the Respond budget packer uses. */
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return text ? Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN)) : 0;
}

export function capText(text: string, max = JEV_CONTEXT_SEGMENT_CHARS): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function contextSegment(
  kind: JevStageContextSegment["kind"],
  label: string,
  text: string,
  role: string | null = null
): JevStageContextSegment {
  const oneLine = text.replace(/\s+/g, " ").trim();

  return {
    kind,
    label,
    role,
    // Tokens count the full text sent, even when the stored copy is capped.
    tokens: estimateTokens(text),
    preview:
      oneLine.length > JEV_CONTEXT_PREVIEW_CHARS
        ? `${oneLine.slice(0, JEV_CONTEXT_PREVIEW_CHARS - 1)}…`
        : oneLine,
    text: capText(text),
    truncated: text.length > JEV_CONTEXT_SEGMENT_CHARS,
  };
}

/** One segment per history message; the newest user message is its own "user" segment. */
export function historySegments(
  messages: ReadonlyArray<{ role: string; text: string }>,
  newestIsUser = true
): JevStageContextSegment[] {
  return messages.map((message, index) =>
    newestIsUser && index === messages.length - 1 && message.role === "user"
      ? contextSegment("user", "Newest message", message.text, "user")
      : contextSegment("history", `History ${index + 1}`, message.text, message.role)
  );
}

/** Tool definitions as names + descriptions. Schemas are sent too but not measured here. */
export function toolDefinitionSegment(tools: Record<string, unknown>): JevStageContextSegment {
  const lines = Object.entries(tools).map(([name, value]) => {
    const description =
      value &&
      typeof value === "object" &&
      typeof (value as { description?: unknown }).description === "string"
        ? (value as { description: string }).description
        : "";

    return description ? `${name}: ${description}` : name;
  });

  return contextSegment(
    "tools",
    `${lines.length} tool definitions (input schemas not counted)`,
    lines.join("\n")
  );
}

export function contextManifest(
  segments: JevStageContextSegment[],
  window: JevStageContextManifest["window"] = null
): JevStageContextManifest {
  return { segments, window };
}

/** What Jev was sent: each question's instructions and options, then the state fields. */
export function jevContextManifest(request: {
  state: Record<string, string>;
  questions: Record<string, unknown>;
}): JevStageContextManifest {
  const segments: JevStageContextSegment[] = [];

  for (const [key, question] of Object.entries(request.questions)) {
    const q = (question ?? {}) as { instructions?: unknown; criteria?: unknown };

    if (typeof q.instructions === "string") {
      segments.push(contextSegment("system", `Question "${key}" instructions`, q.instructions));
    }
    if (q.criteria && typeof q.criteria === "object") {
      const options = Object.entries(q.criteria as Record<string, unknown>)
        .map(([option, criterion]) => `${option}: ${String(criterion)}`)
        .join("\n");

      segments.push(contextSegment("question", `Question "${key}" options`, options));
    }
  }
  const labels: Record<string, [JevStageContextSegment["kind"], string]> = {
    stageSummary: ["summary", "Stage summary"],
    knowledgeHint: ["knowledge", "Knowledge hint"],
    newestUserMessage: ["user", "Newest message"],
  };

  for (const [key, value] of Object.entries(request.state)) {
    const [kind, label] = labels[key] ?? (["knowledge", key] as const);

    segments.push(contextSegment(kind, label, value, kind === "user" ? "user" : null));
  }

  return contextManifest(segments);
}

export function historyWindow(args: {
  total: number;
  kept: number;
  budgetUsd: number | null;
}): NonNullable<JevStageContextManifest["window"]> {
  return {
    budgetUsd: args.budgetUsd,
    total: args.total,
    kept: args.kept,
    dropped: Math.max(0, args.total - args.kept),
  };
}

export type JevCostLine = {
  label: "Uncached input" | "Cached input" | "Output" | "Reasoning";
  tokens: number;
  ratePerMillion: number;
  usd: number;
};

/**
 * One hop's cost, split the way the app bills it (lib/rate-limit/llm-cost.ts): uncached input,
 * cached input at the cache-read rate, output. Reasoning tokens bill as output and are part of
 * the output count; when reported they are shown as a line inside it, not added twice.
 */
export function costBreakdown(
  model: string,
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens?: number | null;
  }
): { lines: JevCostLine[]; totalUsd: number } {
  const cost = getModelCost(model);
  const cached = Math.min(usage.inputTokens, Math.max(0, usage.cachedInputTokens));
  const uncached = Math.max(0, usage.inputTokens - cached);
  const cachedRate = cost.cachedInputPerMillion ?? cost.inputPerMillion;
  const line = (label: JevCostLine["label"], tokens: number, rate: number): JevCostLine => ({
    label,
    tokens,
    ratePerMillion: rate,
    usd: (tokens / 1_000_000) * rate,
  });
  const lines = [
    line("Uncached input", uncached, cost.inputPerMillion),
    line("Cached input", cached, cachedRate),
    line("Output", usage.outputTokens, cost.outputPerMillion),
  ];
  const totalUsd = lines.reduce((sum, entry) => sum + entry.usd, 0);

  if (usage.reasoningTokens) {
    lines.push(
      line("Reasoning", Math.min(usage.reasoningTokens, usage.outputTokens), cost.outputPerMillion)
    );
  }

  return { lines, totalUsd };
}

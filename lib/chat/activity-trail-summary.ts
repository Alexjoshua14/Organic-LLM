import type { UIMessage } from "ai";
import type { ActivityTrail } from "@/lib/chat/activity-trail";

import { formatThoughtDuration, reasoningHeadline } from "@/lib/chat/activity-trail";
import { tryParseWebSearchToolOutput } from "@/lib/chat/web-search-tool-output";

type MessageParts = UIMessage["parts"];

function toolOutput(part: MessageParts[number]): unknown {
  const p = part as { state?: string; output?: unknown; result?: unknown };

  if (p.state === "output-available") return p.output;
  if (p.state === "result") return p.result;

  return undefined;
}

/** Unique source URLs found by web and research searches in this trail. */
export function countTrailSources(parts: MessageParts, trail: ActivityTrail): number {
  const urls = new Set<string>();
  let unnamed = 0;

  for (const step of trail.steps) {
    if (step.kind !== "tool") continue;
    const output = toolOutput(parts[step.partIndex]);
    const name = step.toolName.toLowerCase();

    if (name === "web_search") {
      const parsed = tryParseWebSearchToolOutput(output);

      if (parsed?.status === "success") {
        parsed.rows.forEach((row) => (row.url ? urls.add(row.url) : unnamed++));
      }
    } else if (name === "research_search" && output && typeof output === "object") {
      const sources = (output as { sources?: unknown }).sources;

      if (Array.isArray(sources)) {
        sources.forEach((source) => {
          const url = (source as { url?: unknown } | null)?.url;

          if (typeof url === "string" && url) urls.add(url);
          else unnamed++;
        });
      }
    }
  }

  return urls.size + unnamed;
}

const PAST_TENSE: Array<[RegExp, string]> = [
  [/^(search_memories|memory_search|list_recent_memories)$/, "Checked memories"],
  [
    /^(get_more_chat_history|get_full_chat_history|get_messages_from_date)$/,
    "Read earlier messages",
  ],
  [/^read_subagent_thread$/, "Read a subagent thread"],
  [/^fetch_recipe$/, "Read a recipe"],
  [/^gather_restaurant$/, "Looked up a restaurant"],
  [/^(search_knowledge_nodes|traverse_knowledge_graph)$/, "Explored the knowledge graph"],
  [/^research_/, "Researched sources"],
  [/^web_search$/, "Searched the web"],
];

function pastTense(toolName: string): string {
  const name = toolName.toLowerCase();

  return PAST_TENSE.find(([pattern]) => pattern.test(name))?.[1] ?? "Used tools";
}

/**
 * Settled header: "Thought for 14s · Searched 6 sources". Durations only describe trails with
 * reasoning; tool-only trails fall back to what they did. Null when there is nothing to say.
 */
export function trailSummaryLabel(
  parts: MessageParts,
  trail: ActivityTrail,
  durationMs: number | null
): string | null {
  const labels: string[] = [];
  const sources = countTrailSources(parts, trail);

  if (trail.hasReasoning && durationMs !== null) labels.push(formatThoughtDuration(durationMs));
  if (sources > 0)
    labels.push(
      `${labels.length ? "searched" : "Searched"} ${sources} source${sources === 1 ? "" : "s"}`
    );
  if (labels.length > 0) return labels.join(" · ");

  const firstTool = trail.steps.find((step) => step.kind === "tool");

  if (firstTool?.kind === "tool") return pastTense(firstTool.toolName);

  return trail.steps.some((step) => step.kind === "reasoning" && step.text) ? "Reasoning" : null;
}

/** What the trail is doing right now, from its latest step. */
export function trailLiveHeadline(
  trail: ActivityTrail,
  inFlightLabel: (toolName: string) => string
): string {
  const last = trail.steps[trail.steps.length - 1];

  if (last?.kind === "tool" && last.isInFlight) return inFlightLabel(last.toolName);
  // Latest complete heading across the step, so a half-streamed heading never blanks it.
  if (last?.kind === "reasoning") return reasoningHeadline(last.text) ?? "Thinking…";

  return "Thinking…";
}

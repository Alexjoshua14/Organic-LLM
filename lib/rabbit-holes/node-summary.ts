import { generateText } from "ai";

import type { RabbitHoleNode } from "@/lib/schemas/rabbitHoleSchemas";

import {
  RABBIT_HOLE_NODE_SUMMARY_MAX_OUTPUT_TOKENS,
  RABBIT_HOLE_NODE_SUMMARY_MODEL,
} from "@/lib/rabbit-holes/graph-context-models";
import { extractReadableText } from "@/lib/security/external-content/extract-text";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/rabbit-holes/node-summary.ts");

const NODE_SUMMARY_SYSTEM = `You write a dense reference summary of a rabbit hole article node for retrieval and LLM context.
Cover: topic, main claims, key takeaways, notable sources (titles/URLs when present), and cross-references.
Use compact bullets or short paragraphs. Do not invent facts. Max ~1500 words.`;

export function nodeHasSummaryContent(node: RabbitHoleNode): boolean {
  return Boolean(node.summary?.trim() || node.articleHtml?.trim());
}

export function formatNodeSummaryDocument(node: RabbitHoleNode): string {
  const title = node.title?.trim() || node.userQuestion?.trim() || "Untitled";
  const summary = node.summary?.trim();

  if (summary) {
    return `Title: ${title}\nQuestion: ${node.userQuestion}\nSummary:\n${summary}`;
  }

  const takeaways = node.keyTakeaways?.length
    ? `Key takeaways: ${node.keyTakeaways.join(" | ")}`
    : "";
  const sources = (node.sources ?? [])
    .slice(0, 8)
    .map((s) => `- ${s.title} (${s.url})`)
    .join("\n");
  const { text: articleText } = extractReadableText(node.articleHtml ?? "", {
    maxChars: 12_000,
  });

  return [
    `Title: ${title}`,
    `Question: ${node.userQuestion}`,
    takeaways,
    sources ? `Sources:\n${sources}` : "",
    articleText ? `Article excerpt:\n${articleText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Generate a stored summary for a completed article node (~2000 output token cap).
 */
export async function generateRabbitHoleNodeSummary(
  node: RabbitHoleNode
): Promise<string> {
  const sourceDoc = formatNodeSummaryDocument(node);

  const { text } = await generateText({
    model: RABBIT_HOLE_NODE_SUMMARY_MODEL,
    system: NODE_SUMMARY_SYSTEM,
    prompt: sourceDoc,
    maxOutputTokens: RABBIT_HOLE_NODE_SUMMARY_MAX_OUTPUT_TOKENS,
    temperature: 0.2,
  });

  const trimmed = text.trim();

  logger.log(
    "generateRabbitHoleNodeSummary",
    `Generated summary for node ${node.id} (${trimmed.length} chars)`
  );

  return trimmed;
}

export async function ensureRabbitHoleNodeSummary(node: RabbitHoleNode): Promise<string> {
  const existing = node.summary?.trim();

  if (existing) return existing;

  if (!node.articleHtml?.trim()) return "";

  const generated = await generateRabbitHoleNodeSummary(node);

  return generated;
}

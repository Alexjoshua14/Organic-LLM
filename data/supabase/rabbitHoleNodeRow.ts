import { isUnixTimestamp } from "@/lib/utils";

/** Placeholder key_takeaways for stub/optimistic nodes (DB requires length >= 3). */
const STUB_NODE_KEY_TAKEAWAYS = ["Generating…", "…", "…"] as const;

/** Minimal node shape used when building DB rows (optimistic nodes may have keyTakeaways.length < 3). */
type NodeForRow = {
  id: string;
  rawPrompt: string;
  userQuestion: string;
  keyTakeaways: string[];
  articleHtml: string;
  createdAt: string;
};

/**
 * Map a session node to a rabbit_hole_nodes row for upsert.
 * Uses placeholder key_takeaways when the node has fewer than 3 (stub/optimistic nodes).
 * Exported for unit tests.
 */
export function nodeToRabbitHoleNodeRow(
  node: NodeForRow,
  sessionId: string,
): {
  session_id: string;
  node_id: string;
  raw_prompt: string;
  user_question: string;
  key_takeaways: string[];
  article_html: string;
  created_at: string;
} {
  const keyTakeaways =
    node.keyTakeaways.length >= 3
      ? node.keyTakeaways
      : node.keyTakeaways.length === 0
        ? [...STUB_NODE_KEY_TAKEAWAYS]
        : [...node.keyTakeaways, ...STUB_NODE_KEY_TAKEAWAYS].slice(0, 3);
  return {
    session_id: sessionId,
    node_id: node.id,
    raw_prompt: node.rawPrompt,
    user_question: node.userQuestion,
    key_takeaways: keyTakeaways,
    article_html: node.articleHtml,
    created_at: isUnixTimestamp(node.createdAt)
      ? new Date(Number(node.createdAt)).toISOString()
      : node.createdAt,
  };
}

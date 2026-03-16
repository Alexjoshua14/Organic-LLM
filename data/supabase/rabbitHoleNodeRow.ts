import { isUnixTimestamp } from "@/lib/utils";

/** Minimal node shape used when building DB rows (optimistic nodes may have keyTakeaways.length < 3). */
type NodeForRow = {
  id: string;
  rawPrompt: string;
  userQuestion: string;
  keyTakeaways: string[];
  preview?: string | null;
  articleHtml?: string | null;
  createdAt: string;
};

export type RabbitHoleNodeRow = {
  session_id: string;
  node_id: string;
  raw_prompt: string;
  user_question: string;
  key_takeaways: string[];
  preview?: string | null;
  article_html?: string | null;
  created_at: string;
};

/**
 * Map a session node to a rabbit_hole_nodes row for upsert.
 * Exported for unit tests.
 */
export function nodeToRabbitHoleNodeRow(node: NodeForRow, sessionId: string): RabbitHoleNodeRow {
  const keyTakeaways = node.keyTakeaways;

  return {
    session_id: sessionId,
    node_id: node.id,
    raw_prompt: node.rawPrompt,
    user_question: node.userQuestion,
    key_takeaways: keyTakeaways,
    preview: node.preview ?? null,
    article_html: node.articleHtml,
    created_at: isUnixTimestamp(node.createdAt)
      ? new Date(Number(node.createdAt)).toISOString()
      : node.createdAt,
  };
}

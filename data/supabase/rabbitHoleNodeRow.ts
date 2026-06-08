import { isUnixTimestamp } from "@/lib/utils";

/** Map nullable `rabbit_hole_nodes.title` to optional session node `title`. Exported for tests. */
export function rabbitHoleNodeTitleFromDb(title: string | null | undefined): string | undefined {
  if (title == null) return undefined;
  const t = title.trim();

  return t.length > 0 ? t : undefined;
}

/** Minimal node shape used when building DB rows (optimistic nodes may have keyTakeaways.length < 3). */
type NodeForRow = {
  id: string;
  rawPrompt: string;
  userQuestion: string;
  title?: string | null;
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
  title?: string | null;
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
    title: node.title?.trim() ? node.title.trim() : null,
    key_takeaways: keyTakeaways,
    preview: node.preview ?? null,
    article_html: node.articleHtml,
    created_at: isUnixTimestamp(node.createdAt)
      ? new Date(Number(node.createdAt)).toISOString()
      : node.createdAt,
  };
}

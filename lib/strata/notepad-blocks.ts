import z from "zod";

import { clientRandomUUID } from "@/lib/client-uuid";

export const STRATA_NOTEPAD_BLOCKS_CONTENT_JSON_KEY = "notepadBlocksByNoteId";

export const StrataNotepadBlockTextSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("text"),
  text: z.string(),
});

export const StrataNotepadBlockLinkStateSchema = z.enum([
  "idle",
  "processing",
  "resolved",
  "error",
]);

export type StrataNotepadBlockLinkState = z.infer<typeof StrataNotepadBlockLinkStateSchema>;

export const StrataNotepadBlockLinkSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("link"),
  url: z.string().trim().max(2048),
  state: StrataNotepadBlockLinkStateSchema.default("idle"),
  title: z.string().max(512).optional(),
  summary: z.string().max(8000).optional(),
  statusMessage: z.string().max(280).optional(),
  errorMessage: z.string().max(500).optional(),
});

export const StrataNotepadBlockSchema = z.discriminatedUnion("type", [
  StrataNotepadBlockTextSchema,
  StrataNotepadBlockLinkSchema,
]);

export type StrataNotepadBlock = z.infer<typeof StrataNotepadBlockSchema>;

const StrataNotepadBlocksByNoteIdSchema = z.record(
  z.string().uuid(),
  z.array(StrataNotepadBlockSchema).max(500)
);

export function createTextBlock(text = ""): StrataNotepadBlock {
  return {
    id: clientRandomUUID(),
    type: "text",
    text,
  };
}

export function createLinkBlock(url = ""): StrataNotepadBlock {
  return {
    id: clientRandomUUID(),
    type: "link",
    url,
    state: "idle",
  };
}

export function parseNotepadBlocksByNoteId(
  contentJson: Record<string, unknown> | null | undefined
): Record<string, StrataNotepadBlock[]> {
  const raw = contentJson?.[STRATA_NOTEPAD_BLOCKS_CONTENT_JSON_KEY];
  const parsed = StrataNotepadBlocksByNoteIdSchema.safeParse(raw);

  return parsed.success ? parsed.data : {};
}

export function setNotepadBlocksInContentJson(
  contentJson: Record<string, unknown> | null | undefined,
  blocksByNoteId: Record<string, StrataNotepadBlock[]>
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(contentJson ?? {}) };

  base[STRATA_NOTEPAD_BLOCKS_CONTENT_JSON_KEY] = blocksByNoteId;

  return base;
}

export function blocksToCanonicalMarkdown(blocks: StrataNotepadBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      const text = block.text.trim();

      if (text.length > 0) parts.push(text);
      continue;
    }

    const url = block.url.trim();

    if (!url) continue;
    const title = (block.title ?? "").trim();
    const summary = (block.summary ?? "").trim();
    if (title) {
      parts.push(`[${title}](${url})`);
    } else {
      parts.push(url);
    }
    if (summary) {
      parts.push(summary);
    }
  }

  return parts.join("\n\n").trim();
}

export function inferBlocksFromBody(body: string): StrataNotepadBlock[] {
  const trimmed = body.trim();

  if (trimmed.length === 0) return [createTextBlock("")];

  return [createTextBlock(trimmed)];
}

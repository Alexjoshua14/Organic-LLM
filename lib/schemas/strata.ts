import z from "zod";

export const StrataSectionKeySchema = z.enum([
  "raw_text",
  "refined_text",
  "elaborated",
  "design_instructions",
  "ai_instructions",
]);

export type StrataSectionKey = z.infer<typeof StrataSectionKeySchema>;

export const STRATA_SECTION_ORDER: StrataSectionKey[] = [
  "raw_text",
  "refined_text",
  "elaborated",
  "design_instructions",
  "ai_instructions",
];

/** Default DB and local title when the user does not provide one. */
export const STRATA_DEFAULT_UNTITLED_TITLE = "Untitled Strata page";

export function isUntitledStrataTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();

  return t.length === 0 || t === STRATA_DEFAULT_UNTITLED_TITLE;
}

export const STRATA_DEFAULT_DESIGN_INSTRUCTIONS = `Desktop-first editorial canvas for a 14-inch laptop.
- Render five distinct full-height sections with clear spacing.
- Use elegant typography, calm contrast, and generous whitespace.
- Keep "Raw Text" visually separate from AI-generated sections.
- Favor readable line length (~70-90 chars) and strong hierarchy.`;

export const STRATA_DEFAULT_AI_INSTRUCTIONS = `You are the Strata section composer.
- Use Raw Text as the source of truth.
- Produce Refined Text as near 1:1 cleanup (formatting and clarity only).
- Produce Elaborated content that improves comprehension without inventing unsupported facts.
- Never rewrite Raw Text.
- Never edit Design Instructions or AI Instructions unless explicitly requested.`;

export type StrataSection = {
  key: StrataSectionKey;
  content: string;
  contentJson: Record<string, unknown> | null;
};

export const StrataGenerationContextSchema = z.object({
  lastGeneratedRawText: z.string(),
  lastGeneratedAt: z.string(),
  lastGenerationMode: z.enum(["create", "update"]),
  lastRawDiffSummary: z.string().optional(),
});

export type StrataGenerationContext = z.infer<typeof StrataGenerationContextSchema>;

/** Max characters stored per text source body (client + server enforce). */
export const STRATA_TEXT_SOURCE_BODY_MAX = 120_000;

/** Max characters accepted when pasting into the Strata text ingest field from the clipboard. */
export const STRATA_CLIPBOARD_PASTE_MAX_CHARS = 24_000;

/** POST body for `/api/prototypes/strata/clipboard-source-title`. */
export const StrataClipboardSourceTitleBodySchema = z.object({
  pageId: z.string().min(1).max(128),
  excerpt: z.string().min(1).max(STRATA_CLIPBOARD_PASTE_MAX_CHARS),
});

export type StrataClipboardSourceTitleBody = z.infer<typeof StrataClipboardSourceTitleBodySchema>;

/** Max number of text sources on one page. */
export const STRATA_TEXT_SOURCES_MAX = 80;

export const StrataTextSourceKindSchema = z.enum([
  "user_text",
  "clipboard",
  "file",
  "web_query",
  "url",
]);

export type StrataTextSourceKind = z.infer<typeof StrataTextSourceKindSchema>;

export const StrataTextSourceMetaSchema = z
  .object({
    url: z.string().max(2048).optional(),
    filename: z.string().max(512).optional(),
    query: z.string().max(2000).optional(),
  })
  .strict();

export const StrataTextSourceNodeSchema = z.object({
  id: z.string().uuid(),
  kind: StrataTextSourceKindSchema,
  title: z.string().max(512),
  body: z.string().max(STRATA_TEXT_SOURCE_BODY_MAX),
  createdAt: z.string(),
  meta: StrataTextSourceMetaSchema.optional(),
  /** Notes backed by a server-side Yjs doc bump this on every server snapshot. */
  yjsSnapshotVersion: z.number().int().nonnegative().optional(),
  /** Marker that the note has migrated to the Yjs/BlockNote pipeline. */
  richKind: z.literal("blocknote_v1").optional(),
});

export type StrataTextSourceNode = z.infer<typeof StrataTextSourceNodeSchema>;

export const StrataSourceComposerSettingsSchema = z.object({
  assistantPersonaId: z.enum(["remy", "spark", "aion", "prometheus"]).optional(),
  toolMemory: z.boolean().optional(),
  toolWebSearch: z.boolean().optional(),
  toolMessageSearch: z.boolean().optional(),
  toolKnowledgeSearch: z.boolean().optional(),
});

export type StrataSourceComposerSettings = z.infer<typeof StrataSourceComposerSettingsSchema>;

const pageIdForAuth = z.string().uuid();

export const StrataIngestSearchOpSchema = z.object({
  pageId: pageIdForAuth,
  op: z.literal("search"),
  query: z.string().min(1).max(500),
});

export const StrataIngestUrlPreviewOpSchema = z.object({
  pageId: pageIdForAuth,
  op: z.literal("url_preview"),
  url: z.string().min(1).max(2048),
});

export const StrataIngestUrlCommitOpSchema = z.object({
  pageId: pageIdForAuth,
  op: z.literal("url_commit"),
  url: z.string().min(1).max(2048),
  title: z.string().max(512).optional(),
});

export const StrataIngestAppendTextOpSchema = z.object({
  pageId: pageIdForAuth,
  op: z.literal("append_text"),
  title: z.string().max(512),
  body: z.string().max(STRATA_TEXT_SOURCE_BODY_MAX),
  kind: z.enum(["user_text", "clipboard"]).default("user_text"),
});

export const StrataIngestRequestSchema = z.discriminatedUnion("op", [
  StrataIngestSearchOpSchema,
  StrataIngestUrlPreviewOpSchema,
  StrataIngestUrlCommitOpSchema,
  StrataIngestAppendTextOpSchema,
]);

export type StrataIngestRequest = z.infer<typeof StrataIngestRequestSchema>;

export type StrataPage = {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type StrataPageWithSections = {
  page: StrataPage;
  sections: Record<StrataSectionKey, StrataSection>;
};

export function buildDefaultStrataSections(): Record<StrataSectionKey, StrataSection> {
  return {
    raw_text: { key: "raw_text", content: "", contentJson: null },
    refined_text: { key: "refined_text", content: "", contentJson: null },
    elaborated: { key: "elaborated", content: "", contentJson: null },
    design_instructions: {
      key: "design_instructions",
      content: STRATA_DEFAULT_DESIGN_INSTRUCTIONS,
      contentJson: null,
    },
    ai_instructions: {
      key: "ai_instructions",
      content: STRATA_DEFAULT_AI_INSTRUCTIONS,
      contentJson: null,
    },
  };
}

export function buildStrataPageDefaults(
  pageId: string,
  title: string,
  ownerId: string = "local-device"
): StrataPageWithSections {
  const now = new Date().toISOString();

  return {
    page: {
      id: pageId,
      title,
      owner_id: ownerId,
      created_at: now,
      updated_at: now,
    },
    sections: buildDefaultStrataSections(),
  };
}

export const StrataSectionsSnapshotSchema = z.object({
  raw_text: z.string().default(""),
  refined_text: z.string().default(""),
  elaborated: z.string().default(""),
  design_instructions: z.string().default(""),
  ai_instructions: z.string().default(""),
});

export const StrataGenerateTitleRequestSchema = z.object({
  sectionsSnapshot: StrataSectionsSnapshotSchema.optional(),
  /** From refined_text.contentJson.generatedTitle when using a snapshot (e.g. local / ZDR). */
  refinedGeneratedTitle: z.string().optional(),
  /** When false, title is returned only (client updates local); no `strata_pages` update. */
  applyToDatabase: z.boolean().optional().default(true),
});

export const StrataRawGenerationMetadataSchema = z.object({
  generationContext: StrataGenerationContextSchema.optional(),
});

export const StrataGenerateRequestSchema = z
  .object({
    pageId: z.uuid().optional(),
    mode: z.enum(["create", "update"]),
    sectionsSnapshot: StrataSectionsSnapshotSchema.optional(),
    rawGenerationMetadata: StrataRawGenerationMetadataSchema.optional(),
  })
  .refine((value) => value.sectionsSnapshot != null || value.pageId != null, {
    message: "Either pageId or sectionsSnapshot is required",
    path: ["pageId"],
  });

export const StrataGenerateResponseSchema = z.object({
  refinedTitle: z.string().min(1),
  refinedText: z.string().min(1),
  elaborated: z.string().min(1),
  elaboratedArtifacts: z.record(z.string(), z.unknown()).optional(),
  rawGenerationContext: StrataGenerationContextSchema.optional(),
});

export type StrataGenerateResponse = z.infer<typeof StrataGenerateResponseSchema>;

/**
 * Yjs notepad sync schemas. The wire format always uses **base64** for binary blobs to keep the
 * route JSON-only; clients decode them to `Uint8Array` before applying.
 */
export const StrataYjsBase64Schema = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "base64");

export const StrataYjsClientIdSchema = z.string().min(1).max(64);

export const StrataYjsSnapshotResponseSchema = z.object({
  noteId: z.string().uuid(),
  version: z.number().int().nonnegative(),
  /** Compacted snapshot bytes (base64). May be an empty string when the note has never been compacted. */
  snapshot: StrataYjsBase64Schema,
  /** Server state vector at the time the snapshot was written; client sends back as `lastServerSV`. */
  stateVector: StrataYjsBase64Schema,
  /** Tail of incremental updates appended after `version`. */
  updates: z.array(
    z.object({
      update: StrataYjsBase64Schema,
      createdAt: z.string(),
    })
  ),
});

export type StrataYjsSnapshotResponse = z.infer<typeof StrataYjsSnapshotResponseSchema>;

export const StrataYjsAppendUpdateBodySchema = z.object({
  pageId: pageIdForAuth,
  noteId: z.string().uuid(),
  /** Yjs update encoded with `Y.encodeStateAsUpdateV2(doc, lastServerSV)`. */
  update: StrataYjsBase64Schema,
  clientId: StrataYjsClientIdSchema,
});

export type StrataYjsAppendUpdateBody = z.infer<typeof StrataYjsAppendUpdateBodySchema>;

export const StrataYjsAppendUpdateResponseSchema = z.object({
  noteId: z.string().uuid(),
  /** Snapshot generation. Bumps on inline compaction; clients can use it to invalidate caches. */
  version: z.number().int().nonnegative(),
  /** True when the route compacted this note's pending updates into a fresh snapshot. */
  compacted: z.boolean(),
});

export type StrataYjsAppendUpdateResponse = z.infer<typeof StrataYjsAppendUpdateResponseSchema>;

/** When the appended-updates count exceeds this threshold, the route compacts inline. */
export const STRATA_NOTE_COMPACT_THRESHOLD = 50;

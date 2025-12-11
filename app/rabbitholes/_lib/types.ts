import { z } from "zod";

export type RabbitHoleNodeId = string;

export const RabbitHoleSourceAnalysisSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()).min(3).max(7),
  relevance: z
    .string()
    .describe("How this source relates to the current RabbitHole node"),
  originalUrl: z.url(),
});

export const RabbitHoleSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url(),
  faviconUrl: z.url().optional().or(z.literal("")).or(z.null()),
  snippet: z.string().optional(),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  highlights: z
    .array(z.string())
    .optional()
    .describe("Notable excerpts extracted from the source"),
  analysis: RabbitHoleSourceAnalysisSchema.optional().describe(
    "User-triggered optional analysis"
  ), // Might shift to linking by id instead
  sourceType: z
    .enum(["article", "book", "paper", "video", "blog", "forum"])
    .optional(),
});

export const RabbitHoleBranchSuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  shortDescription: z.string().max(200).optional(),
});

export const RabbitHoleNodeSchema = z.object({
  id: z.string(),
  rawPrompt: z
    .string()
    .describe("The full system prompt string for generation"),
  userQuestion: z.string().describe("User-visible question"),
  keyTakeaways: z.array(z.string()).min(3).max(5),
  articleHtml: z
    .string()
    .describe(
      "HTML string containing section tags, paragraphs, and inline spans only"
    ),
  sources: z.array(RabbitHoleSourceSchema),
  branchSuggestions: z.array(RabbitHoleBranchSuggestionSchema).min(5).max(10),
  createdAt: z.string(),
});

export const RabbitHolePathSegmentSchema = z.object({
  nodeId: z.string(),
  label: z.string(),
  parentNodeId: z.string().nullable(),
});

export const RabbitHoleEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["follow", "reference", "source"]).optional(),
});

export const RabbitHoleSessionSchema = z.object({
  sessionId: z.string(),
  rootQuestion: z.string(),
  path: z.array(RabbitHolePathSegmentSchema),
  nodesById: z.record(z.string(), RabbitHoleNodeSchema),
  activeNodeId: z.string().nullable(),
  edges: z.array(RabbitHoleEdgeSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

// Type exports
export type RabbitHoleSource = z.infer<typeof RabbitHoleSourceSchema>;
export type RabbitHoleBranchSuggestion = z.infer<
  typeof RabbitHoleBranchSuggestionSchema
>;
export type RabbitHoleNode = z.infer<typeof RabbitHoleNodeSchema>;
export type RabbitHolePathSegment = z.infer<typeof RabbitHolePathSegmentSchema>;
export type RabbitHoleEdge = z.infer<typeof RabbitHoleEdgeSchema>;
export type RabbitHoleSession = z.infer<typeof RabbitHoleSessionSchema>;
export type RabbitHoleSourceAnalysis = z.infer<
  typeof RabbitHoleSourceAnalysisSchema
>;

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
  status: z.enum(["none", "pending", "complete", "error"]).default("none"),
  id: z.string().min(1), // TODO: Tighten up cosntraints
  title: z.string(),
  url: z.url(),
  faviconUrl: z.url().optional().or(z.literal("")).or(z.null()),
  snippet: z.string().optional().or(z.null()),
  publishedDate: z.string().optional().or(z.null()),
  author: z.string().optional().or(z.null()),
  highlights: z
    .array(z.string())
    .optional()
    .describe("Notable excerpts extracted from the source"),
  analysis: RabbitHoleSourceAnalysisSchema.optional().describe(
    "User-triggered optional analysis",
  ), // Might shift to linking by id instead
});

export const RabbitHoleBranchSuggestionSchema = z.object({
  id: z.string().min(1), // TODO: Tighten up cosntraints
  label: z.string(),
  shortDescription: z.string().max(200).optional(),
});

export const RabbitHoleNodeSchema = z.object({
  id: z.uuid(),
  rawPrompt: z
    .string()
    .describe("The full system prompt string for generation"),
  userQuestion: z.string().describe("User-visible question"),
  refinedQuestion: z
    .string()
    .describe("Refined question for LLM to respond to")
    .optional()
    .or(z.null()),
  preview: z
    .string()
    .describe("Preview of the node content")
    .optional()
    .or(z.null()),
  keyTakeaways: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("3-5 key takeaways from article"),
  articleHtml: z
    .string()
    .describe(
      "HTML string containing section tags, paragraphs, and inline spans only",
    ),
  sources: z.array(RabbitHoleSourceSchema).optional(),
  branchSuggestions: z
    .array(RabbitHoleBranchSuggestionSchema)
    .min(5)
    .max(11)
    .optional(),
  createdAt: z.string(),
});

export const RabbitHoleAIResponseSchema = RabbitHoleNodeSchema.omit({
  id: true,
  rawPrompt: true,
  userQuestion: true,
  sources: true,
  createdAt: true,
  branchSuggestions: true,
});

export const RabbitHolePathSegmentSchema = z.object({
  nodeId: z.uuid(),
  label: z.string(),
  parentNodeId: z.string().nullable(),
});

export const RabbitHoleEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["follow", "reference", "source"]).optional(),
});

export const RabbitHoleSessionSchema = z.object({
  sessionId: z.uuid().describe("The unique identifier for the session"),
  rootQuestion: z
    .string()
    .describe("The initial question that started the session"),
  rootNodeId: z.uuid().optional().or(z.null()),
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
export type RabbitHoleAIResponse = z.infer<typeof RabbitHoleAIResponseSchema>;
export type RabbitHolePathSegment = z.infer<typeof RabbitHolePathSegmentSchema>;
export type RabbitHoleEdge = z.infer<typeof RabbitHoleEdgeSchema>;
export type RabbitHoleSession = z.infer<typeof RabbitHoleSessionSchema>;
export type RabbitHoleSourceAnalysis = z.infer<
  typeof RabbitHoleSourceAnalysisSchema
>;

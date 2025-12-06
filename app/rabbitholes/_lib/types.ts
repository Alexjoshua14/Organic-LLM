import { z } from "zod";

export type RabbitHoleNodeId = string;

export const RabbitHoleSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  faviconUrl: z.string().url().optional(),
  snippet: z.string().optional(),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

export const RabbitHoleBranchSuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  shortDescription: z.string().optional(),
});

export const RabbitHoleNodeSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  question: z.string(),
  keyTakeaways: z.array(z.string()).min(3).max(5),
  articleHtml: z.string(),
  sources: z.array(RabbitHoleSourceSchema),
  branchSuggestions: z.array(RabbitHoleBranchSuggestionSchema).min(5).max(10),
  createdAt: z.string(),
});

export const RabbitHolePathSegmentSchema = z.object({
  nodeId: z.string(),
  label: z.string(),
});

export const RabbitHoleSessionSchema = z.object({
  sessionId: z.string(),
  rootQuestion: z.string(),
  path: z.array(RabbitHolePathSegmentSchema),
  nodesById: z.record(z.string(), RabbitHoleNodeSchema),
  activeNodeId: z.string().nullable(),
});

export const RabbitHoleSourceAnalysisSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()).min(3).max(7),
  relevance: z.string(),
  originalUrl: z.string().url(),
});

// Type exports
export type RabbitHoleSource = z.infer<typeof RabbitHoleSourceSchema>;
export type RabbitHoleBranchSuggestion = z.infer<
  typeof RabbitHoleBranchSuggestionSchema
>;
export type RabbitHoleNode = z.infer<typeof RabbitHoleNodeSchema>;
export type RabbitHolePathSegment = z.infer<typeof RabbitHolePathSegmentSchema>;
export type RabbitHoleSession = z.infer<typeof RabbitHoleSessionSchema>;
export type RabbitHoleSourceAnalysis = z.infer<
  typeof RabbitHoleSourceAnalysisSchema
>;

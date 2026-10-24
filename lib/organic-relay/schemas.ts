import { z } from "zod";

export const IntrospectionStepSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  hint: z.string().max(2000).optional(),
});

export type IntrospectionStep = z.infer<typeof IntrospectionStepSchema>;

/** LLM / pipeline output and handoff plaintext (no crypto envelope). */
export const OrganicHandoffContentSchema = z.object({
  title: z.string().min(1).max(255),
  goal: z.string().min(1).max(4000),
  systemInstructions: z.string().min(1).max(100_000),
  initialOverview: z.string().min(1).max(20_000),
  steps: z.array(IntrospectionStepSchema).min(1).max(24).optional(),
});

export type OrganicHandoffContent = z.infer<typeof OrganicHandoffContentSchema>;

/** Payload Introspection encrypts before redirecting to Organic LLM. */
export const IntrospectionBootstrapPayloadSchema = z.object({
  v: z.literal(1),
  exp: z.number().int().positive(),
  nonce: z.string().min(8).max(128),
  title: z.string().max(255).optional(),
  goal: z.string().max(4000).optional(),
  systemInstructions: z.string().min(1).max(100_000),
  steps: z.array(IntrospectionStepSchema).max(24).optional(),
  initialOverview: z.string().max(20_000).optional(),
});

export type IntrospectionBootstrapPayload = z.infer<typeof IntrospectionBootstrapPayloadSchema>;

export const IntrospectionHandoffRequestSchema = z.object({
  questionId: z.string().min(1).max(64),
  questionText: z.string().min(1).max(120),
  category: z.string().max(32).optional(),
  llm: z.enum(["claude", "chatgpt", "gemini", "perplexity"]),
  speechFriendly: z.boolean(),
  promptTitle: z.string().min(1).max(255),
  fullPrompt: z.string().min(1).max(100_000),
});

export type IntrospectionHandoffRequest = z.infer<typeof IntrospectionHandoffRequestSchema>;

export const IntrospectionHandoffResponseSchema = z.object({
  url: z.string().url(),
});

export type IntrospectionHandoffResponse = z.infer<typeof IntrospectionHandoffResponseSchema>;

export const IntrospectionBootstrapWireRequestSchema = z.object({
  payload: z.string().min(16).max(512_000),
});

export type IntrospectionBootstrapWireRequest = z.infer<
  typeof IntrospectionBootstrapWireRequestSchema
>;

export const OrganicHandoffCandidateArraySchema = z.object({
  candidates: z.array(OrganicHandoffContentSchema).min(1).max(8),
});

export type OrganicHandoffCandidateArray = z.infer<typeof OrganicHandoffCandidateArraySchema>;

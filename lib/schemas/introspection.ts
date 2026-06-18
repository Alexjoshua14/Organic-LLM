import { z } from "zod";

export const IntrospectionStepSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  hint: z.string().max(2000).optional(),
});

export type IntrospectionStep = z.infer<typeof IntrospectionStepSchema>;

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

/** Server-only config persisted on thread (includes hidden instructions). */
export type IntrospectionStoredConfig = {
  systemInstructions: string;
  title?: string;
  goal?: string;
  steps?: IntrospectionStep[];
  initialOverview?: string;
  bootstrapNonce: string;
};

/** Public guided UI state (safe for client; no system instructions). */
export const IntrospectionGuidedStateSchema = z.object({
  currentStepId: z.string().optional(),
  overviewMarkdown: z.string(),
  breadcrumb: z.array(z.string()),
  stepComplete: z.boolean(),
  title: z.string().optional(),
  goal: z.string().optional(),
  steps: z
    .array(z.object({ id: z.string(), title: z.string() }))
    .optional(),
});

export type IntrospectionGuidedState = z.infer<typeof IntrospectionGuidedStateSchema>;

export const UpdateIntrospectionViewInputSchema = z.object({
  overviewMarkdown: z.string().min(1).max(20_000),
  stepId: z.string().max(64).optional(),
  breadcrumb: z.array(z.string().max(120)).max(12).optional(),
  stepComplete: z.boolean().optional(),
});

export type UpdateIntrospectionViewInput = z.infer<typeof UpdateIntrospectionViewInputSchema>;

export function buildInitialGuidedState(
  config: Pick<
    IntrospectionStoredConfig,
    "title" | "goal" | "steps" | "initialOverview"
  >
): IntrospectionGuidedState {
  const steps = config.steps?.map((s) => ({ id: s.id, title: s.title }));
  const firstStep = config.steps?.[0];

  return {
    currentStepId: firstStep?.id,
    overviewMarkdown:
      config.initialOverview?.trim() ||
      (config.goal
        ? `## ${config.title ?? "Guided session"}\n\n${config.goal}`
        : `## ${config.title ?? "Guided session"}\n\nWelcome — your guide will appear here shortly.`),
    breadcrumb: config.title ? [config.title] : ["Introspection"],
    stepComplete: false,
    title: config.title,
    goal: config.goal,
    steps,
  };
}

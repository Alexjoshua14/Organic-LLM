import { z } from "zod";

export {
  IntrospectionBootstrapPayloadSchema,
  IntrospectionStepSchema,
  type IntrospectionBootstrapPayload,
  type IntrospectionStep,
} from "@/lib/organic-relay/schemas";

/** Server-only config persisted on thread (includes hidden instructions). */
export type IntrospectionStoredConfig = {
  systemInstructions: string;
  title?: string;
  goal?: string;
  steps?: import("@/lib/organic-relay/schemas").IntrospectionStep[];
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

import { z } from "zod";

export const HomepageRoutePreviewSchema = z.object({
  intent: z.enum(["new_chat", "continue_thread", "rabbit_hole", "strata", "settings", "other"]),
  confidence: z.number().min(0).max(1),
  label: z.string().max(200),
});

export type HomepageRoutePreview = z.infer<typeof HomepageRoutePreviewSchema>;

export const PlanActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("new_chat"),
    rationale: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal("rabbit_hole"),
    seed: z.string().max(8000).optional(),
    rationale: z.string().max(2000).optional(),
  }),
]);

export const HomepagePlanIntentSchema = z.object({
  actions: z.array(PlanActionSchema).max(8),
  t3codeSuggested: z.boolean().optional(),
});

export type HomepagePlanIntent = z.infer<typeof HomepagePlanIntentSchema>;
export type PlanAction = z.infer<typeof PlanActionSchema>;

const T3CODE_TOKEN = "t3code";

export function userTextContainsT3CodeToken(text: string): boolean {
  return text.includes(T3CODE_TOKEN);
}

export function buildT3CodeCraftedPrompt(userText: string): string {
  const trimmed = userText.trim();

  return [
    "You are an internal knowledge assistant for the Organic LLM codebase and product.",
    "Answer accurately and cite uncertainty where needed.",
    "User request (they invoked this path by including the token t3code in their message):",
    trimmed,
  ].join("\n\n");
}

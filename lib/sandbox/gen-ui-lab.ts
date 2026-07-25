import { z } from "zod";

import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import { ALL_VALID_FIXTURES } from "@/lib/schemas/gen-ui/fixtures";
import { GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "@/lib/schemas/gen-ui/shared";

export const GEN_UI_LAB_MODEL = "openai/gpt-5.4-mini" as const;

export const GenUiLabViewModeSchema = z.enum(["gallery", "focus"]);
export type GenUiLabViewMode = z.infer<typeof GenUiLabViewModeSchema>;

export const GenUiLabIntentSchema = z.enum(["auto", "generate", "select"]);
export type GenUiLabIntent = z.infer<typeof GenUiLabIntentSchema>;

export const GenUiLabBlockTypeSchema = z.enum(GEN_UI_BLOCK_TYPES);

export const GenUiLabRequestSchema = z.object({
  prompt: z.string().min(1).max(8_000),
  selectedBlockType: GenUiLabBlockTypeSchema.optional(),
  viewMode: GenUiLabViewModeSchema.optional(),
  intent: GenUiLabIntentSchema.default("auto"),
});

export type GenUiLabRequest = z.infer<typeof GenUiLabRequestSchema>;

export type GenUiLabSelection = {
  blockType: GenUIBlockType;
  viewMode: GenUiLabViewMode;
};

export type GenUiLabGenerated = {
  blockType: GenUIBlockType;
  block: GenUIBlock;
};

export type GenUiLabApiResponse = {
  message: string;
  selection?: GenUiLabSelection;
  generated?: GenUiLabGenerated;
};

export type GenUiLabAction =
  | { type: "select"; blockType: GenUIBlockType; viewMode: GenUiLabViewMode }
  | { type: "generate"; blockType: GenUIBlockType; block: GenUIBlock };

export function buildDefaultBlockMap(): Record<GenUIBlockType, GenUIBlock> {
  const map = {} as Record<GenUIBlockType, GenUIBlock>;

  for (const block of ALL_VALID_FIXTURES) {
    map[block.type] = block;
  }

  return map;
}

export const GEN_UI_LAB_AION_SYSTEM = `You are Aion in the Gen UI Lab — a sandbox for structured UI archetypes.

Available block types (archetypes):
- answer-card — multi-point answers with TL;DR and key points
- decision-matrix — weighted comparisons across options
- plan-timeline — phased plans with step status
- audio-snippet — listen/recap scripts
- recipe-card — ingredients + steps for a dish
- shopping-list — grouped grocery items with have/need status
- restaurant-card — venue with hero/gallery https images, combined ratings (yelp/google/beli), hours, menu with lastUpdated, popular times, links

Tools:
- select_gen_ui_archetype — when the user wants to view, focus, or switch to a specific archetype
- render_gen_ui — when the user wants fresh content generated for an archetype (use real, specific information when possible)

Rules:
- Call at most one tool per request unless the user clearly asks to both select and generate.
- Prefer select_gen_ui_archetype for "show me", "focus", "switch to", "open" requests.
- Prefer render_gen_ui for "generate", "fill", "populate", "create sample", or topic-specific content requests.
- For restaurant-card: use real venue names, plausible https image URLs, accurate menu items when known, menu.lastUpdated as YYYY-MM-DD, and working website/yelp/directions links.
- Keep any plain-text reply to one short sentence.
- Respect schema caps from the render_gen_ui tool.`.trim();

export function buildGenUiLabPrompt(input: GenUiLabRequest): string {
  const context: string[] = [`User request: ${input.prompt}`];

  if (input.selectedBlockType) {
    context.push(`Currently selected archetype: ${input.selectedBlockType}`);
  }

  if (input.viewMode) {
    context.push(`Current view mode: ${input.viewMode}`);
  }

  if (input.intent === "generate" && input.selectedBlockType) {
    context.push(
      `Explicit action: generate a fresh ${input.selectedBlockType} block using the user's prompt as topic/context. Call render_gen_ui once.`
    );
  }

  if (input.intent === "select") {
    context.push("Explicit action: select/focus the requested archetype. Call select_gen_ui_archetype.");
  }

  return context.join("\n");
}

export function actionsToApiResponse(
  actions: GenUiLabAction[],
  message: string
): GenUiLabApiResponse {
  const selectionAction = [...actions].reverse().find((a) => a.type === "select");
  const generateAction = [...actions].reverse().find((a) => a.type === "generate");

  return {
    message: message.trim() || "Done.",
    selection: selectionAction
      ? { blockType: selectionAction.blockType, viewMode: selectionAction.viewMode }
      : undefined,
    generated: generateAction
      ? { blockType: generateAction.blockType, block: generateAction.block }
      : undefined,
  };
}

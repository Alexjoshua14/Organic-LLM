import { z } from "zod";

import {
  AnswerCardBlockSchema,
  answerCardToMarkdown,
  answerCardToMarkdownLoose,
} from "./answer-card";
import {
  AudioSnippetBlockSchema,
  audioSnippetToMarkdown,
  audioSnippetToMarkdownLoose,
} from "./audio-snippet";
import {
  DecisionMatrixBlockSchema,
  decisionMatrixToMarkdown,
  decisionMatrixToMarkdownLoose,
} from "./decision-matrix";
import {
  PlanTimelineBlockSchema,
  planTimelineToMarkdown,
  planTimelineToMarkdownLoose,
} from "./plan-timeline";
import {
  RecipeCardBlockSchema,
  recipeCardToMarkdown,
  recipeCardToMarkdownLoose,
} from "./recipe-card";
import {
  ShoppingListBlockSchema,
  shoppingListToMarkdown,
  shoppingListToMarkdownLoose,
} from "./shopping-list";
import { GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "./shared";

export { GEN_UI_VERSION, GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "./shared";
export * from "./answer-card";
export * from "./decision-matrix";
export * from "./plan-timeline";
export * from "./audio-snippet";
export * from "./recipe-card";
export * from "./shopping-list";

export const GenUIBlockSchema = z.discriminatedUnion("type", [
  AnswerCardBlockSchema,
  DecisionMatrixBlockSchema,
  PlanTimelineBlockSchema,
  AudioSnippetBlockSchema,
  RecipeCardBlockSchema,
  ShoppingListBlockSchema,
]);

export type GenUIBlock = z.infer<typeof GenUIBlockSchema>;

/** Tool return shape — strict contract for client hydrate. */
export const RenderGenUiToolOutputSchema = z.object({
  block: GenUIBlockSchema,
});

export type RenderGenUiToolOutput = z.infer<typeof RenderGenUiToolOutputSchema>;

/** Best-effort block for partial UI (may omit required fields). */
export type PartialGenUIBlock = {
  type?: GenUIBlockType;
  [key: string]: unknown;
};

export type SafeParseGenUIResult =
  | { ok: true; block: GenUIBlock; hadPartialFailures: false }
  | {
      ok: true;
      block: GenUIBlock;
      hadPartialFailures: true;
      errors: z.ZodError;
    }
  | {
      ok: false;
      partial?: PartialGenUIBlock;
      errors: z.ZodError;
    };

function getBlockType(raw: unknown): GenUIBlockType | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = (raw as Record<string, unknown>).type;

  if (typeof t !== "string") return undefined;

  return GEN_UI_BLOCK_TYPES.includes(t as GenUIBlockType) ? (t as GenUIBlockType) : undefined;
}

function tryLenientParse(type: GenUIBlockType, raw: unknown): GenUIBlock | null {
  switch (type) {
    case "answer-card": {
      const r = AnswerCardBlockSchema.safeParse(raw);

      return r.success ? r.data : null;
    }
    case "decision-matrix": {
      const r = DecisionMatrixBlockSchema.safeParse(raw);

      return r.success ? r.data : null;
    }
    case "plan-timeline": {
      const r = PlanTimelineBlockSchema.safeParse(raw);

      return r.success ? r.data : null;
    }
    case "audio-snippet": {
      const r = AudioSnippetBlockSchema.safeParse(raw);

      return r.success ? r.data : null;
    }
    case "recipe-card": {
      const r = RecipeCardBlockSchema.safeParse(raw);

      return r.success ? r.data : null;
    }
    case "shopping-list": {
      const r = ShoppingListBlockSchema.safeParse(raw);

      return r.success ? r.data : null;
    }
    default:
      return null;
  }
}

/**
 * Parse a gen-UI block from tool output or stored message data.
 * Uses strict parse first; lenient per-type schemas (with z.catch) on failure.
 */
export function safeParseGenUIBlock(raw: unknown): SafeParseGenUIResult {
  const strict = GenUIBlockSchema.safeParse(raw);

  if (strict.success) {
    return { ok: true, block: strict.data, hadPartialFailures: false };
  }

  const blockType = getBlockType(raw);

  if (blockType) {
    const lenient = tryLenientParse(blockType, raw);

    if (lenient) {
      return {
        ok: true,
        block: lenient,
        hadPartialFailures: true,
        errors: strict.error,
      };
    }
  }

  const partial: PartialGenUIBlock | undefined =
    raw && typeof raw === "object" ? (raw as PartialGenUIBlock) : undefined;

  return { ok: false, partial, errors: strict.error };
}

/** Extract block from tool output `{ block }` wrapper. */
export function extractGenUIBlockFromToolOutput(output: unknown): unknown {
  if (!output || typeof output !== "object") return output;
  const o = output as Record<string, unknown>;

  if ("block" in o && o.block != null) return o.block;

  return output;
}

export function genUIBlockToMarkdown(block: GenUIBlock): string {
  switch (block.type) {
    case "answer-card":
      return answerCardToMarkdown(block);
    case "decision-matrix":
      return decisionMatrixToMarkdown(block);
    case "plan-timeline":
      return planTimelineToMarkdown(block);
    case "audio-snippet":
      return audioSnippetToMarkdown(block);
    case "recipe-card":
      return recipeCardToMarkdown(block);
    case "shopping-list":
      return shoppingListToMarkdown(block);
  }
}

/** Fallback markdown when block cannot be fully parsed. */
export function genUIBlockToMarkdownLoose(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return "_Structured block (could not render)_";
  }
  const o = raw as Record<string, unknown>;
  const type = getBlockType(o);

  switch (type) {
    case "answer-card":
      return answerCardToMarkdownLoose(o);
    case "decision-matrix":
      return decisionMatrixToMarkdownLoose(o);
    case "plan-timeline":
      return planTimelineToMarkdownLoose(o);
    case "audio-snippet":
      return audioSnippetToMarkdownLoose(o);
    case "recipe-card":
      return recipeCardToMarkdownLoose(o);
    case "shopping-list":
      return shoppingListToMarkdownLoose(o);
    default:
      return "_Structured block (could not render)_";
  }
}

export function isGenUIBlockType(value: string): value is GenUIBlockType {
  return GEN_UI_BLOCK_TYPES.includes(value as GenUIBlockType);
}

/** Peek streaming / partial tool input for discriminator. */
export function peekGenUIBlockType(input: unknown): GenUIBlockType | undefined {
  return getBlockType(input);
}

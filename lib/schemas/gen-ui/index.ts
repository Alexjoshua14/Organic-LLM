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
  RestaurantCardBlockSchema,
  restaurantCardToMarkdown,
  restaurantCardToMarkdownLoose,
} from "./restaurant-card";
import {
  ShoppingListBlockSchema,
  shoppingListToMarkdown,
  shoppingListToMarkdownLoose,
} from "./shopping-list";
import { CodeDiffBlockSchema, codeDiffToMarkdown, codeDiffToMarkdownLoose } from "./code-diff";
import {
  ResearchReportBlockSchema,
  researchReportToMarkdown,
  researchReportToMarkdownLoose,
} from "./research-report";
import {
  MeasureBlockSchema,
  measureToMarkdown,
  measureToMarkdownLoose,
} from "./measure";
import {
  ProfileMapBlockSchema,
  profileMapToMarkdown,
  profileMapToMarkdownLoose,
} from "./profile-map";
import {
  ErgonBoardBlockSchema,
  ErgonProposalBlockSchema,
  ergonBoardToMarkdown,
  ergonBoardToMarkdownLoose,
  ergonProposalToMarkdown,
  ergonProposalToMarkdownLoose,
} from "./ergon";
import {
  StateDiagramBlockSchema,
  stateDiagramToMarkdown,
  stateDiagramToMarkdownLoose,
} from "./state-diagram";
import {
  PromptFieldBlockSchema,
  promptFieldToMarkdown,
  promptFieldToMarkdownLoose,
} from "./prompt-field";
import {
  ProgressTrackBlockSchema,
  progressTrackToMarkdown,
  progressTrackToMarkdownLoose,
} from "./progress-track";
import {
  ContextSwitchboardBlockSchema,
  contextSwitchboardToMarkdown,
  contextSwitchboardToMarkdownLoose,
} from "./context-switchboard";
import {
  RipplePreviewBlockSchema,
  ripplePreviewToMarkdown,
  ripplePreviewToMarkdownLoose,
} from "./ripple-preview";
import {
  HypGraphBlockSchema,
  hypGraphToMarkdown,
  hypGraphToMarkdownLoose,
} from "./hyp-graph";
import {
  AuditLineBlockSchema,
  auditLineToMarkdown,
  auditLineToMarkdownLoose,
} from "./audit-line";
import {
  PreviewBlobBlockSchema,
  previewBlobToMarkdown,
  previewBlobToMarkdownLoose,
} from "./preview-blob";
import { GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "./shared";

export { GEN_UI_VERSION, GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "./shared";
export * from "./answer-card";
export * from "./decision-matrix";
export * from "./plan-timeline";
export * from "./audio-snippet";
export * from "./recipe-card";
export * from "./shopping-list";
export * from "./restaurant-card";
export * from "./research-report";
export * from "./code-diff";
export * from "./measure";
export * from "./profile-map";
export * from "./ergon";
export * from "./state-diagram";
export * from "./prompt-field";
export * from "./progress-track";
export * from "./context-switchboard";
export * from "./ripple-preview";
export * from "./hyp-graph";
export * from "./audit-line";
export * from "./preview-blob";

export const GenUIBlockSchema = z.discriminatedUnion("type", [
  AnswerCardBlockSchema,
  DecisionMatrixBlockSchema,
  PlanTimelineBlockSchema,
  AudioSnippetBlockSchema,
  RecipeCardBlockSchema,
  ShoppingListBlockSchema,
  RestaurantCardBlockSchema,
  ResearchReportBlockSchema,
  CodeDiffBlockSchema,
  MeasureBlockSchema,
  ProfileMapBlockSchema,
  ErgonBoardBlockSchema,
  ErgonProposalBlockSchema,
  StateDiagramBlockSchema,
  PromptFieldBlockSchema,
  ProgressTrackBlockSchema,
  ContextSwitchboardBlockSchema,
  RipplePreviewBlockSchema,
  HypGraphBlockSchema,
  AuditLineBlockSchema,
  PreviewBlobBlockSchema,
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

const LENIENT_SCHEMAS = {
  "answer-card": AnswerCardBlockSchema,
  "decision-matrix": DecisionMatrixBlockSchema,
  "plan-timeline": PlanTimelineBlockSchema,
  "audio-snippet": AudioSnippetBlockSchema,
  "recipe-card": RecipeCardBlockSchema,
  "shopping-list": ShoppingListBlockSchema,
  "restaurant-card": RestaurantCardBlockSchema,
  "research-report": ResearchReportBlockSchema,
  "code-diff": CodeDiffBlockSchema,
  measure: MeasureBlockSchema,
  "profile-map": ProfileMapBlockSchema,
  "ergon-board": ErgonBoardBlockSchema,
  "ergon-proposal": ErgonProposalBlockSchema,
  "state-diagram": StateDiagramBlockSchema,
  "prompt-field": PromptFieldBlockSchema,
  "progress-track": ProgressTrackBlockSchema,
  "context-switchboard": ContextSwitchboardBlockSchema,
  "ripple-preview": RipplePreviewBlockSchema,
  "hyp-graph": HypGraphBlockSchema,
  "audit-line": AuditLineBlockSchema,
  "preview-blob": PreviewBlobBlockSchema,
} as const;

function tryLenientParse(type: GenUIBlockType, raw: unknown): GenUIBlock | null {
  const schema = LENIENT_SCHEMAS[type];
  const r = schema.safeParse(raw);

  return r.success ? (r.data as GenUIBlock) : null;
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
    case "restaurant-card":
      return restaurantCardToMarkdown(block);
    case "research-report":
      return researchReportToMarkdown(block);
    case "code-diff":
      return codeDiffToMarkdown(block);
    case "measure":
      return measureToMarkdown(block);
    case "profile-map":
      return profileMapToMarkdown(block);
    case "ergon-board":
      return ergonBoardToMarkdown(block);
    case "ergon-proposal":
      return ergonProposalToMarkdown(block);
    case "state-diagram":
      return stateDiagramToMarkdown(block);
    case "prompt-field":
      return promptFieldToMarkdown(block);
    case "progress-track":
      return progressTrackToMarkdown(block);
    case "context-switchboard":
      return contextSwitchboardToMarkdown(block);
    case "ripple-preview":
      return ripplePreviewToMarkdown(block);
    case "hyp-graph":
      return hypGraphToMarkdown(block);
    case "audit-line":
      return auditLineToMarkdown(block);
    case "preview-blob":
      return previewBlobToMarkdown(block);
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
    case "restaurant-card":
      return restaurantCardToMarkdownLoose(o);
    case "research-report":
      return researchReportToMarkdownLoose(o);
    case "code-diff":
      return codeDiffToMarkdownLoose(o);
    case "measure":
      return measureToMarkdownLoose(o);
    case "profile-map":
      return profileMapToMarkdownLoose(o);
    case "ergon-board":
      return ergonBoardToMarkdownLoose(o);
    case "ergon-proposal":
      return ergonProposalToMarkdownLoose(o);
    case "state-diagram":
      return stateDiagramToMarkdownLoose(o);
    case "prompt-field":
      return promptFieldToMarkdownLoose(o);
    case "progress-track":
      return progressTrackToMarkdownLoose(o);
    case "context-switchboard":
      return contextSwitchboardToMarkdownLoose(o);
    case "ripple-preview":
      return ripplePreviewToMarkdownLoose(o);
    case "hyp-graph":
      return hypGraphToMarkdownLoose(o);
    case "audit-line":
      return auditLineToMarkdownLoose(o);
    case "preview-blob":
      return previewBlobToMarkdownLoose(o);
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

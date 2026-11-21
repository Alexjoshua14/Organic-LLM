import type { ComponentType } from "react";
import type { GenUIBlock, GenUIBlockType } from "@/lib/schemas/gen-ui";

import { AnswerCard } from "./blocks/AnswerCard";
import { AudioSnippet } from "./blocks/AudioSnippet";
import { AuditLine } from "./blocks/AuditLine";
import { CodeDiff } from "./blocks/CodeDiff";
import { ContextSwitchboard } from "./blocks/ContextSwitchboard";
import { DecisionMatrix } from "./blocks/DecisionMatrix";
import { ErgonBoard } from "./blocks/ErgonBoard";
import { ErgonProposal } from "./blocks/ErgonProposal";
import { HypGraph } from "./blocks/HypGraph";
import { Measure } from "./blocks/Measure";
import { PlanTimeline } from "./blocks/PlanTimeline";
import { PreviewBlob } from "./blocks/PreviewBlob";
import { ProfileMap } from "./blocks/ProfileMap";
import { ProgressTrack } from "./blocks/ProgressTrack";
import { PromptField } from "./blocks/PromptField";
import { RecipeCard } from "./blocks/RecipeCard";
import { ResearchReport } from "./blocks/ResearchReport";
import { RestaurantCard } from "./blocks/restaurant-card/RestaurantCard";
import { RipplePreview } from "./blocks/RipplePreview";
import { ShoppingList } from "./blocks/ShoppingList";
import { StateDiagram } from "./blocks/StateDiagram";

import {
  genUIBlockToMarkdown,
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
  codeDiffTitle,
} from "@/lib/schemas/gen-ui";

export type GenUIBlockComponentProps = {
  block: GenUIBlock;
  partial?: boolean;
};

export type GenUIRegistryEntry = {
  label: string;
  schema:
    | typeof AnswerCardBlockSchema
    | typeof DecisionMatrixBlockSchema
    | typeof PlanTimelineBlockSchema
    | typeof AudioSnippetBlockSchema
    | typeof RecipeCardBlockSchema
    | typeof ShoppingListBlockSchema
    | typeof RestaurantCardBlockSchema
    | typeof ResearchReportBlockSchema
    | typeof CodeDiffBlockSchema
    | typeof MeasureBlockSchema
    | typeof ProfileMapBlockSchema
    | typeof ErgonBoardBlockSchema
    | typeof ErgonProposalBlockSchema
    | typeof StateDiagramBlockSchema
    | typeof PromptFieldBlockSchema
    | typeof ProgressTrackBlockSchema
    | typeof ContextSwitchboardBlockSchema
    | typeof RipplePreviewBlockSchema
    | typeof HypGraphBlockSchema
    | typeof AuditLineBlockSchema
    | typeof PreviewBlobBlockSchema;
  Component: ComponentType<GenUIBlockComponentProps>;
  toMarkdown: (block: GenUIBlock) => string;
};

export const GEN_UI_REGISTRY: Record<GenUIBlockType, GenUIRegistryEntry> = {
  "research-report": {
    label: "Research",
    schema: ResearchReportBlockSchema,
    Component: ResearchReport as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "answer-card": {
    label: "Answer",
    schema: AnswerCardBlockSchema,
    Component: AnswerCard as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "decision-matrix": {
    label: "Comparison",
    schema: DecisionMatrixBlockSchema,
    Component: DecisionMatrix as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "plan-timeline": {
    label: "Plan",
    schema: PlanTimelineBlockSchema,
    Component: PlanTimeline as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "audio-snippet": {
    label: "Audio",
    schema: AudioSnippetBlockSchema,
    Component: AudioSnippet as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "recipe-card": {
    label: "Recipe",
    schema: RecipeCardBlockSchema,
    Component: RecipeCard as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "shopping-list": {
    label: "Shopping",
    schema: ShoppingListBlockSchema,
    Component: ShoppingList as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "restaurant-card": {
    label: "Restaurant",
    schema: RestaurantCardBlockSchema,
    Component: RestaurantCard as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "code-diff": {
    label: "Code diff",
    schema: CodeDiffBlockSchema,
    Component: CodeDiff as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  measure: {
    label: "Measure",
    schema: MeasureBlockSchema,
    Component: Measure as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "profile-map": {
    label: "Profile map",
    schema: ProfileMapBlockSchema,
    Component: ProfileMap as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "ergon-board": {
    label: "Ergon board",
    schema: ErgonBoardBlockSchema,
    Component: ErgonBoard as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "ergon-proposal": {
    label: "Ergon proposal",
    schema: ErgonProposalBlockSchema,
    Component: ErgonProposal as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "state-diagram": {
    label: "State diagram",
    schema: StateDiagramBlockSchema,
    Component: StateDiagram as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "prompt-field": {
    label: "Prompt field",
    schema: PromptFieldBlockSchema,
    Component: PromptField as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "progress-track": {
    label: "Progress",
    schema: ProgressTrackBlockSchema,
    Component: ProgressTrack as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "context-switchboard": {
    label: "Context",
    schema: ContextSwitchboardBlockSchema,
    Component: ContextSwitchboard as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "ripple-preview": {
    label: "Ripple",
    schema: RipplePreviewBlockSchema,
    Component: RipplePreview as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "hyp-graph": {
    label: "Hypothesis",
    schema: HypGraphBlockSchema,
    Component: HypGraph as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "audit-line": {
    label: "Audit",
    schema: AuditLineBlockSchema,
    Component: AuditLine as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
  "preview-blob": {
    label: "Preview",
    schema: PreviewBlobBlockSchema,
    Component: PreviewBlob as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
};

export function getGenUIBlockTitle(block: GenUIBlock): string {
  switch (block.type) {
    case "answer-card":
    case "research-report":
    case "measure":
    case "profile-map":
    case "ergon-board":
    case "ergon-proposal":
    case "state-diagram":
    case "prompt-field":
    case "progress-track":
    case "context-switchboard":
    case "ripple-preview":
    case "hyp-graph":
    case "audit-line":
    case "preview-blob":
    case "plan-timeline":
    case "recipe-card":
    case "shopping-list":
      return block.title;
    case "decision-matrix":
      return block.question;
    case "audio-snippet":
      return block.preview.title;
    case "restaurant-card":
      return block.name;
    case "code-diff":
      return codeDiffTitle(block);
  }
}

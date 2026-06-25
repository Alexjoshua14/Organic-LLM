import type { ComponentType } from "react";
import type { GenUIBlock, GenUIBlockType } from "@/lib/schemas/gen-ui";

import { AnswerCard } from "./blocks/AnswerCard";
import { AudioSnippet } from "./blocks/AudioSnippet";
import { DecisionMatrix } from "./blocks/DecisionMatrix";
import { PlanTimeline } from "./blocks/PlanTimeline";
import { RecipeCard } from "./blocks/RecipeCard";
import { ShoppingList } from "./blocks/ShoppingList";

import {
  genUIBlockToMarkdown,
  AnswerCardBlockSchema,
  DecisionMatrixBlockSchema,
  PlanTimelineBlockSchema,
  AudioSnippetBlockSchema,
  RecipeCardBlockSchema,
  ShoppingListBlockSchema,
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
    | typeof ShoppingListBlockSchema;
  Component: ComponentType<GenUIBlockComponentProps>;
  toMarkdown: (block: GenUIBlock) => string;
};

export const GEN_UI_REGISTRY: Record<GenUIBlockType, GenUIRegistryEntry> = {
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
    label: "Shopping list",
    schema: ShoppingListBlockSchema,
    Component: ShoppingList as ComponentType<GenUIBlockComponentProps>,
    toMarkdown: genUIBlockToMarkdown,
  },
};

export function getGenUIBlockTitle(block: GenUIBlock): string {
  switch (block.type) {
    case "answer-card":
      return block.title;
    case "decision-matrix":
      return block.question;
    case "plan-timeline":
      return block.title;
    case "audio-snippet":
      return block.preview.title;
    case "recipe-card":
      return block.title;
    case "shopping-list":
      return block.title;
  }
}

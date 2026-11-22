import { z } from "zod";

import { AnswerCardBlockSchema } from "@/lib/schemas/gen-ui/answer-card";
import { CodeDiffBlockSchema } from "@/lib/schemas/gen-ui/code-diff";
import { DecisionMatrixBlockSchema } from "@/lib/schemas/gen-ui/decision-matrix";
import { PlanTimelineBlockSchema } from "@/lib/schemas/gen-ui/plan-timeline";
import { RecipeCardBlockSchema } from "@/lib/schemas/gen-ui/recipe-card";
import { RestaurantCardBlockSchema } from "@/lib/schemas/gen-ui/restaurant-card";
import { ShoppingListBlockSchema } from "@/lib/schemas/gen-ui/shopping-list";

// Blocks the designer may author. Research reports and audio carry thread ids and fetched
// sources the designer cannot invent, so they only come from real tool results.
const DESIGNER_BLOCKS = {
  "answer-card": AnswerCardBlockSchema,
  "decision-matrix": DecisionMatrixBlockSchema,
  "plan-timeline": PlanTimelineBlockSchema,
  "recipe-card": RecipeCardBlockSchema,
  "shopping-list": ShoppingListBlockSchema,
  "restaurant-card": RestaurantCardBlockSchema,
  "code-diff": CodeDiffBlockSchema,
} as const;

export type DesignerBlockType = keyof typeof DESIGNER_BLOCKS;

export const DESIGNER_BLOCK_TYPES = Object.keys(DESIGNER_BLOCKS) as DesignerBlockType[];

/** Compact JSON Schemas, derived from the real zod schemas so the prompt can't drift from them. */
const shapes = new Map<DesignerBlockType, string>();

export function designerBlockShapes(
  types: readonly DesignerBlockType[] = DESIGNER_BLOCK_TYPES
): string {
  return types
    .map((type) => {
      const cached = shapes.get(type);

      if (cached) return cached;
      const json = z.toJSONSchema(DESIGNER_BLOCKS[type], {
        io: "input",
        unrepresentable: "any",
      }) as Record<string, unknown>;

      delete json.$schema;

      // Drop only noise. Preserve the value shape of maps such as decision-matrix scores.
      const shape = `${type}: ${JSON.stringify(json, (key, value) =>
        key === "description" || (key === "additionalProperties" && value === false)
          ? undefined
          : value
      )}`;

      shapes.set(type, shape);

      return shape;
    })
    .join("\n");
}

/** A designer-authored block as a parsed value, or the exact fields that were wrong. */
export function parseDesignerBlock(
  json: string | null | undefined
):
  | { ok: true; block: z.infer<(typeof DESIGNER_BLOCKS)[DesignerBlockType]> }
  | { ok: false; reason: string } {
  let value: unknown;

  try {
    value = JSON.parse(json ?? "");
  } catch {
    return { ok: false, reason: "block is not valid JSON" };
  }
  const type = (value as { type?: string } | null)?.type;
  const schema = DESIGNER_BLOCKS[type as DesignerBlockType];

  if (!schema)
    return {
      ok: false,
      reason: `block type must be one of ${Object.keys(DESIGNER_BLOCKS).join(", ")}`,
    };
  const parsed = schema.safeParse(value);

  return parsed.success
    ? { ok: true, block: parsed.data }
    : {
        ok: false,
        reason: `${type} is invalid at ${parsed.error.issues
          .slice(0, 4)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      };
}

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

type DesignerBlockType = keyof typeof DESIGNER_BLOCKS;

/** Compact JSON Schemas, derived from the real zod schemas so the prompt can't drift from them. */
let shapes: string | null = null;

export function designerBlockShapes(): string {
  shapes ??= Object.entries(DESIGNER_BLOCKS)
    .map(([type, schema]) => {
      const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<
        string,
        unknown
      >;

      delete json.$schema;

      return `${type}: ${JSON.stringify(json, (key, value) =>
        key === "description" || key === "additionalProperties" ? undefined : value
      )}`;
    })
    .join("\n");

  return shapes;
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

import { describe, expect, test } from "bun:test";

import { HOUSEWARMING_INITIATE } from "@/lib/schemas/mise/fixtures";
import {
  MiseCommandSchema,
  safeParseMiseCommand,
  MisePlanToolOutputSchema,
} from "@/lib/schemas/mise";

describe("MiseCommandSchema", () => {
  test("accepts the housewarming INITIATE_PLAN fixture", () => {
    const parsed = MiseCommandSchema.safeParse(HOUSEWARMING_INITIATE);

    expect(parsed.success).toBe(true);
  });

  test("SET_INGREDIENT_STATUS requires status or checked", () => {
    const bad = safeParseMiseCommand({ type: "SET_INGREDIENT_STATUS", version: 1, id: "x" });

    expect(bad.ok).toBe(false);

    const good = safeParseMiseCommand({
      type: "SET_INGREDIENT_STATUS",
      version: 1,
      id: "x",
      checked: true,
    });

    expect(good.ok).toBe(true);
  });

  test("UPSERT_RECIPES rejects a recipe with no steps", () => {
    const parsed = safeParseMiseCommand({
      type: "UPSERT_RECIPES",
      version: 1,
      recipes: [{ id: "r1", title: "Bad", ingredients: [{ name: "flour" }], steps: [] }],
    });

    expect(parsed.ok).toBe(false);
  });

  test("SHOW_VIEW round-trips through the tool output schema", () => {
    const output = {
      kind: "mise-view" as const,
      view: { id: "v1", title: "Shopping list", intent: "shopping-list" as const },
    };

    expect(MisePlanToolOutputSchema.safeParse(output).success).toBe(true);
  });

  test("rejects an unknown command type", () => {
    expect(safeParseMiseCommand({ type: "NOPE", version: 1 }).ok).toBe(false);
  });
});

import { expect, test } from "bun:test";
import { z } from "zod";
import { DESIGN_PLAN } from "@/lib/stage/design-schema";

test("designer schema uses provider-compatible alternatives and still rejects invalid operations", () => {
  const schema = z.toJSONSchema(DESIGN_PLAN);
  expect(JSON.stringify(schema)).not.toContain('"oneOf"');
  expect(JSON.stringify(schema)).toContain('"anyOf"');
  expect(
    DESIGN_PLAN.safeParse({ operations: [{ operation: "remove", targetId: crypto.randomUUID() }] })
      .success
  ).toBe(true);
  expect(DESIGN_PLAN.safeParse({ operations: [{ operation: "remove" }] }).success).toBe(false);
});

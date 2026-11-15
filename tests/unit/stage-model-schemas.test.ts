import { expect, test } from "bun:test";
import { z } from "zod";

import { DESIGN_PLAN } from "@/lib/stage/design-schema";
import { StageWorkerOutputSchema } from "@/lib/stage/worker-output";

/**
 * Strict structured output (OpenAI via the gateway) refuses a schema outright when any object
 * property is missing from `required`, before the model runs. Every Stage designer call failed
 * this way while `view` was optional. Optional fields must be required and nullable instead.
 */
function optionalProperties(node: unknown, path = "$"): string[] {
  if (!node || typeof node !== "object") return [];
  const schema = node as Record<string, unknown>;
  const found: string[] = [];

  if (schema.properties && typeof schema.properties === "object") {
    const required = new Set((schema.required as string[] | undefined) ?? []);

    for (const key of Object.keys(schema.properties))
      if (!required.has(key)) found.push(`${path}.${key}`);
  }
  for (const [key, value] of Object.entries(schema))
    if (Array.isArray(value))
      value.forEach((item, index) => found.push(...optionalProperties(item, `${path}.${key}[${index}]`)));
    else if (value && typeof value === "object")
      found.push(...optionalProperties(value, `${path}.${key}`));

  return found;
}

test.each([
  ["designer plan", DESIGN_PLAN],
  ["specialist output", StageWorkerOutputSchema],
] as const)("the %s schema requires every property, as strict output demands", (_, schema) => {
  expect(optionalProperties(z.toJSONSchema(schema, { unrepresentable: "any" }))).toEqual([]);
});

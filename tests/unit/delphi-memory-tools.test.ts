import { describe, expect, test } from "bun:test";
import { zodSchema } from "ai";

import {
  DELPHI_MEMORY_TEXT_MAX,
  commitMemoryInputSchema,
  emptyOptionalText,
  flagPayloadSchema,
  linkMemoriesInputSchema,
  proposeMemoryInputSchema,
} from "@/lib/llm/delphi-memory-tool-schemas";
import {
  GetMoreMessagesToolSchema,
  SearchMemoryToolSchema,
  clampHistoryMessageLimit,
} from "@/lib/llm/chat-tool-schemas";

/** Patterns that break function-calling across gateway providers. */
function collectFunctionCallingSchemaIssues(value: unknown, path = ""): string[] {
  if (value == null || typeof value !== "object") {
    return [];
  }

  const issues: string[] = [];
  const record = value as Record<string, unknown>;

  if (Array.isArray(record.enum) && record.enum.some((item) => typeof item === "number")) {
    issues.push(`${path || "(root)"}: numeric enum ${JSON.stringify(record.enum)}`);
  }

  if (record.minimum === 1) {
    issues.push(`${path || "(root)"}: minimum === 1`);
  }

  if (record.minLength === 1) {
    issues.push(`${path || "(root)"}: minLength === 1`);
  }

  if (record.oneOf || record.anyOf) {
    issues.push(`${path || "(root)"}: has oneOf/anyOf`);
  }

  for (const [key, nested] of Object.entries(record)) {
    issues.push(
      ...collectFunctionCallingSchemaIssues(nested, path ? `${path}.${key}` : key)
    );
  }

  return issues;
}

const CHAT_TOOL_SCHEMAS = [
  ["proposeMemoryInputSchema", proposeMemoryInputSchema],
  ["commitMemoryInputSchema", commitMemoryInputSchema],
  ["linkMemoriesInputSchema", linkMemoriesInputSchema],
  ["flagPayloadSchema", flagPayloadSchema],
  ["SearchMemoryToolSchema", SearchMemoryToolSchema],
  ["GetMoreMessagesToolSchema", GetMoreMessagesToolSchema],
] as const;

describe("chat tool schemas (gateway-safe)", () => {
  test.each(CHAT_TOOL_SCHEMAS)("%s JSON schema is function-calling safe", (_name, schema) => {
    const jsonSchema = zodSchema(schema).jsonSchema;
    const issues = collectFunctionCallingSchemaIssues(jsonSchema);

    expect(issues).toEqual([]);
  });

  test("SearchMemoryToolSchema is query-only (no optional limit oneOf)", () => {
    const jsonSchema = zodSchema(SearchMemoryToolSchema).jsonSchema as {
      required?: string[];
      properties?: Record<string, unknown>;
    };

    expect(jsonSchema.required).toEqual(["query"]);
    expect(Object.keys(jsonSchema.properties ?? {})).toEqual(["query"]);
  });

  test("flagPayloadSchema requires all fields (no Zod optional oneOf)", () => {
    const jsonSchema = zodSchema(flagPayloadSchema).jsonSchema as {
      required?: string[];
    };

    expect(jsonSchema.required?.sort()).toEqual(["context", "memory_id", "note"]);
  });

  test("propose_memory accepts valid payload", () => {
    const r = proposeMemoryInputSchema.safeParse({
      text: "User prefers tea.",
      rationale: "",
    });

    expect(r.success).toBe(true);
  });

  test("propose_memory rejects text over max", () => {
    const r = proposeMemoryInputSchema.safeParse({
      text: "x".repeat(DELPHI_MEMORY_TEXT_MAX + 1),
      rationale: "",
    });

    expect(r.success).toBe(false);
  });

  test("commit_memory accepts topic", () => {
    const r = commitMemoryInputSchema.safeParse({
      text: "Canonical fact.",
      topic: "prefs",
    });

    expect(r.success).toBe(true);
  });

  test("emptyOptionalText treats blank strings as absent", () => {
    expect(emptyOptionalText("")).toBeUndefined();
    expect(emptyOptionalText("  ")).toBeUndefined();
    expect(emptyOptionalText("mem_1")).toBe("mem_1");
  });

  test("clampHistoryMessageLimit clamps at execute time", () => {
    expect(clampHistoryMessageLimit(undefined)).toBe(10);
    expect(clampHistoryMessageLimit(0)).toBe(1);
    expect(clampHistoryMessageLimit(99)).toBe(50);
  });
});

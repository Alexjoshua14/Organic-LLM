import { beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("@/lib/llm/metrics", () => ({
  recordLlmCall: () => {},
}));

let generateShortTitleFromSummary: typeof import("@/lib/llm/short-title-from-summary").generateShortTitleFromSummary;

beforeAll(async () => {
  ({ generateShortTitleFromSummary } = await import("@/lib/llm/short-title-from-summary"));
});

describe("generateShortTitleFromSummary", () => {
  test("whitespace-only summary returns empty data without LLM", async () => {
    const result = await generateShortTitleFromSummary("   \n\t  ", {
      contextId: "test-ctx",
      operation: "unit-test",
      subject: "chat",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBe("");
  });

  test("empty string summary returns empty data without LLM", async () => {
    const result = await generateShortTitleFromSummary("", {
      contextId: "test-ctx",
      operation: "unit-test",
      subject: "strata",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBe("");
  });
});

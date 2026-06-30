import { describe, expect, test } from "bun:test";

import { tryParseMermaidToolOutput } from "@/components/chat/mermaid-tool-ack-card";

describe("tryParseMermaidToolOutput", () => {
  test("treats a plain string body as an error (output-error path)", () => {
    expect(tryParseMermaidToolOutput("boom")).toEqual({ kind: "error", message: "boom" });
  });

  test("falls back to a generic message for an empty string", () => {
    expect(tryParseMermaidToolOutput("   ")).toEqual({
      kind: "error",
      message: "Diagram generation failed.",
    });
  });

  test("returns null for null/undefined/non-object bodies", () => {
    expect(tryParseMermaidToolOutput(null)).toBeNull();
    expect(tryParseMermaidToolOutput(undefined)).toBeNull();
    expect(tryParseMermaidToolOutput(42)).toBeNull();
  });

  test("surfaces an explicit failure with its error message", () => {
    expect(tryParseMermaidToolOutput({ success: false, error: "Parse error on line 2" })).toEqual({
      kind: "error",
      message: "Parse error on line 2",
    });
  });

  test("uses validationError when error is absent on a failure", () => {
    expect(
      tryParseMermaidToolOutput({ success: false, validationError: "bad token" })
    ).toEqual({ kind: "error", message: "bad token" });
  });

  test("reports success with no warning for clean output", () => {
    expect(
      tryParseMermaidToolOutput({ success: true, code: "flowchart TD\n  A --> B" })
    ).toEqual({ kind: "ok" });
  });

  test("carries a validation warning when present", () => {
    const parsed = tryParseMermaidToolOutput({
      success: true,
      code: "flowchart TD\n  A --> B",
      validationError: "Mindmap may not render",
    });

    expect(parsed).toEqual({ kind: "ok", validationWarning: "Mindmap may not render" });
  });

  test("truncates an overlong validation warning with an ellipsis", () => {
    const long = "x".repeat(200);
    const parsed = tryParseMermaidToolOutput({
      success: true,
      code: "flowchart TD\n  A --> B",
      validationError: long,
    });

    expect(parsed?.kind).toBe("ok");
    if (parsed?.kind === "ok") {
      expect(parsed.validationWarning?.endsWith("…")).toBe(true);
      expect(parsed.validationWarning!.length).toBeLessThanOrEqual(121);
    }
  });

  test("returns null when success is true but there is no usable code", () => {
    expect(tryParseMermaidToolOutput({ success: true, code: "" })).toBeNull();
    expect(tryParseMermaidToolOutput({})).toBeNull();
  });
});

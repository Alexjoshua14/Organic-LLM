import { describe, expect, test } from "bun:test";

import {
  classifyMermaidValidationError,
  extractMermaidCode,
  normalizeMermaidCode,
  stripMermaidSecurityInitDirectives,
} from "@/lib/mermaid/source";

describe("stripMermaidSecurityInitDirectives", () => {
  test("removes an init directive that sets securityLevel", () => {
    const src = '%%{init: {"securityLevel":"strict"}}%%\nflowchart TD\n  A --> B';
    const out = stripMermaidSecurityInitDirectives(src);

    expect(out).not.toContain("securityLevel");
    expect(out).toContain("flowchart TD");
    expect(out).toContain("A --> B");
  });

  test("keeps init directives that do not touch securityLevel", () => {
    const src = '%%{init: {"theme":"forest"}}%%\nflowchart TD\n  A --> B';
    const out = stripMermaidSecurityInitDirectives(src);

    expect(out).toContain('"theme":"forest"');
  });

  test("leaves ordinary comments and diagram body untouched", () => {
    const src = "flowchart TD\n  %% a normal comment\n  A --> B";
    const out = stripMermaidSecurityInitDirectives(src);

    expect(out).toBe(src);
  });
});

describe("normalizeMermaidCode", () => {
  test("strips ```mermaid fences and trims", () => {
    const raw = "```mermaid\nflowchart TD\n  A --> B\n```";
    expect(normalizeMermaidCode(raw)).toBe("flowchart TD\n  A --> B");
  });

  test("strips a bare ``` fence", () => {
    const raw = "```\nsequenceDiagram\n  Alice->>Bob: Hi\n```";
    expect(normalizeMermaidCode(raw)).toBe("sequenceDiagram\n  Alice->>Bob: Hi");
  });

  test("removes a leading securityLevel init directive while unfencing", () => {
    const raw = '```mermaid\n%%{init: {"securityLevel":"loose"}}%%\nflowchart TD\n  A --> B\n```';
    const out = normalizeMermaidCode(raw);

    expect(out).not.toContain("securityLevel");
    expect(out.startsWith("flowchart TD")).toBe(true);
  });

  test("is a no-op for already-clean code", () => {
    const raw = "flowchart LR\n  A --> B";
    expect(normalizeMermaidCode(raw)).toBe(raw);
  });
});

describe("extractMermaidCode", () => {
  test("reads `code` off the tool result object", () => {
    expect(extractMermaidCode({ success: true, code: "flowchart TD\n  A --> B" })).toBe(
      "flowchart TD\n  A --> B"
    );
  });

  test("ignores an object with empty/missing code", () => {
    expect(extractMermaidCode({ success: true, code: "   " })).toBeNull();
    expect(extractMermaidCode({ success: false })).toBeNull();
  });

  test("recognizes bare diagram strings across diagram types", () => {
    for (const head of [
      "flowchart TD",
      "graph LR",
      "sequenceDiagram",
      "stateDiagram-v2",
      "classDiagram",
      "erDiagram",
      "mindmap",
    ]) {
      const code = `${head}\n  A --> B`;
      expect(extractMermaidCode(code)).toBe(code);
    }
  });

  test("extracts from a fenced ```mermaid block inside a string", () => {
    const body = "Here is your diagram:\n```mermaid\nflowchart TD\n  A --> B\n```\nEnjoy.";
    expect(extractMermaidCode(body)).toBe("flowchart TD\n  A --> B");
  });

  test("returns null for unrelated strings and non-objects", () => {
    expect(extractMermaidCode("just some prose")).toBeNull();
    expect(extractMermaidCode(null)).toBeNull();
    expect(extractMermaidCode(42)).toBeNull();
  });
});

describe("classifyMermaidValidationError", () => {
  test("flags runtime/environment failures so the caller can fail open", () => {
    const envMessages = [
      'Unsupported color format: "#eee"',
      "DOMPurify.sanitize is not a function.",
      "DOMPurify.addHook is not a function.",
      "sanitize is not a function",
      "Cannot read properties of undefined (reading 'sanitize')",
      "document is not defined",
      "window is not defined",
      "CSSStyleSheet is not defined",
    ];

    for (const msg of envMessages) {
      expect(classifyMermaidValidationError(msg)).toBe("environment");
    }
  });

  test("treats real parse errors as syntax", () => {
    const syntaxMessages = [
      "Parse error on line 2:\n...My Node --> X\n-----^\nExpecting 'SEMI'",
      "Expecting 'NEWLINE', got 'PS'",
      "No diagram type detected matching given configuration",
      "",
    ];

    for (const msg of syntaxMessages) {
      expect(classifyMermaidValidationError(msg)).toBe("syntax");
    }
  });
});

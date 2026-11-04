import { describe, expect, test } from "bun:test";

import { GITHUB_PASSTHROUGH_CHARS } from "@/lib/github/policy";
import { parseJevEvaluateResponse, resolveGithubRoute } from "@/lib/llm/github/route";

const largeCode = `export function run() {\n  return true;\n}\n${"const n = 1;\n".repeat(200)}`;

describe("resolveGithubRoute", () => {
  test("returns short files without a model when fidelity is auto", () => {
    const route = resolveGithubRoute({
      requested: "auto",
      path: "README.md",
      question: "What is this?",
      text: "A short readme.",
      jev: {
        fidelity: "summary",
        fidelityConfidence: 0.99,
        distiller: "luna",
        distillerConfidence: 0.99,
      },
    });

    expect(route.router).toBe("passthrough");
    expect(route.fidelity).toBe("raw");
    expect(route.skipModel).toBe(true);
    expect(largeCode.length).toBeGreaterThan(GITHUB_PASSTHROUGH_CHARS);
  });

  test("uses the heuristic when Jev is unsure", () => {
    const route = resolveGithubRoute({
      requested: "auto",
      path: "lib/run.ts",
      question: "show the function body",
      text: largeCode,
      jev: {
        fidelity: "summary",
        fidelityConfidence: 0.4,
        distiller: "haiku",
        distillerConfidence: 0.4,
      },
    });

    expect(route.router).toBe("heuristic");
    expect(route.fidelity).toBe("excerpts");
    expect(route.distiller).toBe("kimi");
    expect(route.skipModel).toBe(false);
  });

  test("accepts a confident Jev choice", () => {
    const route = resolveGithubRoute({
      requested: "auto",
      path: "docs/guide.md",
      question: "What does this guide decide?",
      text: largeCode,
      jev: {
        fidelity: "summary",
        fidelityConfidence: 0.91,
        distiller: "terra",
        distillerConfidence: 0.8,
      },
    });

    expect(route.router).toBe("jev");
    expect(route.fidelity).toBe("summary");
    expect(route.distiller).toBe("terra");
  });

  test("keeps an explicit fidelity and still takes a confident distiller", () => {
    const route = resolveGithubRoute({
      requested: "summary",
      path: "lib/run.ts",
      question: "security review of this module",
      text: largeCode,
      jev: {
        fidelity: "raw",
        fidelityConfidence: 0.99,
        distiller: "haiku",
        distillerConfidence: 0.7,
      },
    });

    expect(route.fidelity).toBe("summary");
    expect(route.distiller).toBe("haiku");
    expect(route.router).toBe("jev");
  });

  test("routes architecture questions to terra when Jev is absent", () => {
    const route = resolveGithubRoute({
      requested: "auto",
      path: "lib/run.ts",
      question: "Give me an architecture review of this file",
      text: largeCode,
      jev: null,
    });

    expect(route.distiller).toBe("terra");
    expect(route.fidelity).toBe("summary");
    expect(route.router).toBe("heuristic");
  });
});

describe("parseJevEvaluateResponse", () => {
  test("reads choice probabilities and drops unknown labels", () => {
    const parsed = parseJevEvaluateResponse({
      answers: {
        fidelity: { type: "choice", choice: "excerpts", probabilities: { excerpts: 0.66 } },
        distiller: { type: "choice", choice: "gpt-6-astra", probabilities: { "gpt-6-astra": 0.9 } },
      },
    });

    expect(parsed.fidelity).toBe("excerpts");
    expect(parsed.fidelityConfidence).toBe(0.66);
    expect(parsed.distiller).toBeNull();
  });

  test("ignores a choice that has no probability", () => {
    const parsed = parseJevEvaluateResponse({
      answers: { fidelity: { type: "choice", choice: "raw" } },
    });

    expect(parsed.fidelity).toBe("raw");
    expect(parsed.fidelityConfidence).toBeNull();
  });
});

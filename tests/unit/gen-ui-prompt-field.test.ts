import { describe, expect, test } from "bun:test";

import {
  promptSuggestionApplied,
  togglePromptSuggestion,
} from "@/components/chat/gen-ui/blocks/PromptField";

describe("PromptField suggestion toggle", () => {
  const base = "Explain the tradeoff in one paragraph for a senior engineer.";
  const cautious = "Call out uncertainty explicitly.";
  const shorter = "Keep it under 80 words.";

  test("applies a suggestion as its own paragraph", () => {
    const next = togglePromptSuggestion(base, cautious);

    expect(next).toBe(`${base}\n\n${cautious}`);
    expect(promptSuggestionApplied(next, cautious)).toBe(true);
    expect(promptSuggestionApplied(next, shorter)).toBe(false);
  });

  test("second click removes that suggestion instead of appending again", () => {
    const once = togglePromptSuggestion(base, cautious);
    const twice = togglePromptSuggestion(once, cautious);

    expect(twice).toBe(base);
    expect(promptSuggestionApplied(twice, cautious)).toBe(false);
  });

  test("stacks distinct suggestions without space-gluing", () => {
    const next = togglePromptSuggestion(togglePromptSuggestion(base, cautious), shorter);

    expect(next).toBe(`${base}\n\n${cautious}\n\n${shorter}`);
  });

  test("empty draft becomes the suggestion text alone", () => {
    expect(togglePromptSuggestion("", cautious)).toBe(cautious);
  });
});

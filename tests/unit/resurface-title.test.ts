import { describe, expect, test } from "bun:test";

import {
  clampAtWord,
  clampResurfaceRecap,
  clampResurfaceTitle,
  RESURFACE_RECAP_MAX_CHARS,
  RESURFACE_TITLE_MAX_CHARS,
} from "@/lib/resurface/title";

describe("clampResurfaceTitle", () => {
  test("a short title passes through, minus quotes, extra spaces and a trailing period", () => {
    expect(clampResurfaceTitle('  "Rewrite the  sidebar pager."  ')).toBe(
      "Rewrite the sidebar pager"
    );
  });

  test("a long title is cut at a word boundary within the two-line budget", () => {
    const title = clampResurfaceTitle(
      "Plan the move from the encrypted vector store to a dedicated Qdrant cluster with backups"
    );

    expect(title.length).toBeLessThanOrEqual(RESURFACE_TITLE_MAX_CHARS);
    expect(title.endsWith("…")).toBe(true);
    // Whole words only: the character before the ellipsis ends a word from the source.
    expect(title.slice(0, -1).split(" ").at(-1)).toMatch(/^[A-Za-z]+$/);
  });

  test("only the first sentence of a memory becomes the title", () => {
    expect(
      clampResurfaceTitle("Wants a weekly meal-prep plan built around tofu. Prefers Sundays.")
    ).toBe("Wants a weekly meal-prep plan built around tofu");
  });

  test("an abbreviation is not mistaken for the end of a sentence", () => {
    expect(clampResurfaceTitle("e.g. sketch the onboarding flow")).toBe(
      "e.g. sketch the onboarding flow"
    );
  });

  test("one unbroken run of characters is still cut to the budget", () => {
    const title = clampResurfaceTitle("x".repeat(200));

    expect(title.length).toBe(RESURFACE_TITLE_MAX_CHARS);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("clampAtWord", () => {
  test("strips dangling punctuation before the ellipsis", () => {
    expect(clampAtWord("alpha beta, gamma delta epsilon", 13)).toBe("alpha beta…");
  });
});

describe("clampResurfaceRecap", () => {
  test("keeps a spoken recap under its ceiling", () => {
    const recap = clampResurfaceRecap("word ".repeat(200));

    expect(recap.length).toBeLessThanOrEqual(RESURFACE_RECAP_MAX_CHARS);
  });
});

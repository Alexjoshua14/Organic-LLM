import { describe, expect, test } from "bun:test";

import { LANGUAGE_SAMPLES } from "@/app/sandbox/prototypes/_fixtures/language-samples";
import { buildLanguageDiffBlock } from "@/app/sandbox/prototypes/gen-ui-lab/_components/lab-languages";
import { createShuffleBag } from "@/app/sandbox/prototypes/gen-ui-lab/_hooks/use-gen-ui-language-rotation";
import { HIGHLIGHT_LANGUAGES, languageForPath } from "@/components/shared/code-highlight";
import { resolveCodeDiffFiles } from "@/lib/diff/resolve-file";

describe("lab language samples", () => {
  test("every supported language has exactly one sample, and nothing else is listed", () => {
    const ids = LANGUAGE_SAMPLES.map((sample) => sample.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...HIGHLIGHT_LANGUAGES].sort());
  });

  test("each sample's path resolves back to its language, so the diff block colors it", () => {
    for (const sample of LANGUAGE_SAMPLES) {
      expect({ id: sample.id, resolved: languageForPath(sample.path) }).toEqual({
        id: sample.id,
        resolved: sample.id,
      });
    }
  });

  test("diffs are well formed and the snippet is exactly the diff's result", () => {
    for (const sample of LANGUAGE_SAMPLES) {
      const [header, ...lines] = sample.diff.split("\n");

      expect(header).toBe("@@");
      expect(lines.every((line) => " +-".includes(line[0] ?? "?"))).toBe(true);
      expect(lines.some((line) => line.startsWith("-"))).toBe(true);
      expect(lines.some((line) => line.startsWith("+"))).toBe(true);
      expect(
        lines
          .filter((line) => !line.startsWith("-"))
          .map((line) => line.slice(1))
          .join("\n")
      ).toBe(sample.code);
      // A fence inside a fence would swallow the rest of the message.
      expect(sample.code).not.toContain("```");
    }
  });

  test("each diff parses with real counts and becomes a valid code-diff block", () => {
    for (const sample of LANGUAGE_SAMPLES) {
      const block = buildLanguageDiffBlock(sample);
      const [file] = resolveCodeDiffFiles(block.files);

      expect(block.type).toBe("code-diff");
      expect(file?.countsKnown).toBe(true);
      expect(file?.added).toBeGreaterThan(0);
      expect(file?.removed).toBeGreaterThan(0);
    }
  });
});

/** Deterministic pseudo-random numbers, so a shuffle assertion cannot flake. */
function seeded(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

describe("shuffle bag", () => {
  const items = LANGUAGE_SAMPLES.map((sample) => sample.id);

  test("every language appears exactly once per round, across many rounds", () => {
    const bag = createShuffleBag(items, seeded(7));

    for (let round = 0; round < 20; round += 1) {
      const seen = Array.from({ length: items.length }, () => bag.next());

      expect([...seen].sort()).toEqual([...items].sort());
    }
  });

  test("the order is random, not the list order, and differs between rounds", () => {
    const bag = createShuffleBag(items, seeded(11));
    const first = Array.from({ length: items.length }, () => bag.next());
    const second = Array.from({ length: items.length }, () => bag.next());

    expect(first).not.toEqual(items);
    expect(second).not.toEqual(first);
  });

  test("a language never shows twice in a row, including across the seam between rounds", () => {
    for (const seed of [1, 2, 3, 4, 5, 99]) {
      const bag = createShuffleBag(items, seeded(seed));
      const run = Array.from({ length: items.length * 6 }, () => bag.next());

      for (let i = 1; i < run.length; i += 1) expect(run[i]).not.toBe(run[i - 1]);
    }
  });

  test("a hand-picked language counts as shown this round, and is not next", () => {
    const bag = createShuffleBag(["a", "b", "c"], seeded(3));

    bag.see("b");
    expect(bag.next()).not.toBe("b");
    // Two items remain in the round, minus the one just drawn; picking again removes it too.
    const rest = [bag.next(), bag.next()];

    expect(rest.includes("b")).toBe(true);
    expect(bag.remaining()).toBe(0);
  });

  test("one item repeats; an empty list is the caller's problem, not a hang", () => {
    expect(createShuffleBag(["only"]).next()).toBe("only");
  });
});

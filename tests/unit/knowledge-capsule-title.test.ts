import { describe, expect, test } from "bun:test";

import {
  joinSlots,
  KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS,
  normalizeKnowledgeCapsuleSlots,
  parseFreeformCapsuleLine,
  parseKnowledgeCapsuleTitle,
  splitWords,
} from "@/lib/llm/knowledge-capsule-title-grammar";

describe("knowledge capsule grammar", () => {
  test("splitWords ignores extra whitespace", () => {
    expect(splitWords("  Fix   Next  hydration ")).toEqual(["Fix", "Next", "hydration"]);
  });

  test("joinSlots skips empty parts", () => {
    expect(joinSlots({ action: "", subject: "New chat", additional: "" })).toBe("New chat");
    expect(joinSlots({ action: "Fix", subject: "Next hydration", additional: "" })).toBe(
      "Fix Next hydration"
    );
  });

  test("normalize truncates per-slot over 2 words", () => {
    const { slots, repaired, notes } = normalizeKnowledgeCapsuleSlots({
      action: "Please carefully design",
      subject: "the order schema tables",
      additional: "",
    });

    expect(repaired).toBe(true);
    expect(slots.action).toBe("Please carefully");
    expect(slots.subject).toBe("the order");
    expect(notes.some((n) => n.includes("action truncated"))).toBe(true);
    expect(notes.some((n) => n.includes("subject truncated"))).toBe(true);
  });

  test("normalize drops additional words to enforce 5-word combined cap", () => {
    const { slots, repaired } = normalizeKnowledgeCapsuleSlots({
      action: "Plan weekend",
      subject: "Kyoto trip",
      additional: "food trains",
    });

    expect(repaired).toBe(true);
    expect(joinSlots(slots)).toBe("Plan weekend Kyoto trip food");
    expect(splitWords(joinSlots(slots)).length).toBeLessThanOrEqual(
      KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS
    );
  });

  test("parseKnowledgeCapsuleTitle accepts well-formed JSON", () => {
    const parsed = parseKnowledgeCapsuleTitle(
      '{"action":"Design","subject":"order schema","additional":""}'
    );

    expect(parsed.status).toBe("ok");
    expect(parsed.title).toBe("Design order schema");
    expect(parsed.slots).toEqual({
      action: "Design",
      subject: "order schema",
      additional: "",
    });
    expect(parsed.wordCount).toBe(3);
  });

  test("parseKnowledgeCapsuleTitle repairs overlong JSON slots", () => {
    const parsed = parseKnowledgeCapsuleTitle(
      '{"action":"Plan weekend","subject":"Kyoto trip","additional":"food trains"}'
    );

    expect(parsed.status).toBe("repaired");
    expect(parsed.title).toBe("Plan weekend Kyoto trip food");
    expect(parsed.wordCount).toBe(5);
  });

  test("parseKnowledgeCapsuleTitle falls back to freeform when JSON missing", () => {
    const parsed = parseKnowledgeCapsuleTitle("Draft vendor decline email note");

    expect(parsed.status).toBe("repaired");
    expect(parsed.notes.some((n) => n.includes("freeform"))).toBe(true);
    expect(parsed.wordCount).toBeLessThanOrEqual(KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS);
    expect(parsed.title.length).toBeGreaterThan(0);
  });

  test("parseFreeformCapsuleLine maps word windows into slots", () => {
    expect(parseFreeformCapsuleLine("A B C D E F G")).toEqual({
      action: "A B",
      subject: "C D",
      additional: "E F",
    });
  });

  test("empty output is invalid", () => {
    const parsed = parseKnowledgeCapsuleTitle("   ");

    expect(parsed.status).toBe("invalid");
    expect(parsed.title).toBe("");
  });
});

import { describe, expect, it } from "bun:test";

import { STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS } from "@/lib/strata/assistant-persona-guide";

describe("STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS", () => {
  it("has unique ids and valid levels", () => {
    const ids = STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const s of STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS) {
      expect(s.level).toBeGreaterThanOrEqual(1);
      expect(s.level).toBeLessThanOrEqual(3);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.bodyMarkdown.length).toBeGreaterThan(0);
    }
  });
});

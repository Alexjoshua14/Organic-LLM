import { describe, test, expect } from "bun:test";

import { buildStrataSystemSuffix } from "@/lib/llm/strata-chat-augmentation";
import { buildDefaultStrataSections } from "@/lib/schemas/strata";

describe("buildStrataSystemSuffix", () => {
  test("strata_hub includes hub instructions", async () => {
    const s = await buildStrataSystemSuffix({
      experience: "strata_hub",
      sbUserId: "u1",
      fetchPage: async () => null,
    });
    expect(s).toContain("[Strata hub mode]");
    expect(s).toContain("navigate_to_strata_page");
  });

  test("strata_page with matching owner appends grounding", async () => {
    const pageId = "00000000-0000-4000-8000-000000000001";
    const fetchPage = async () => ({
      page: {
        id: pageId,
        title: "Test page",
        owner_id: "owner-1",
        created_at: "",
        updated_at: "",
      },
      sections: buildDefaultStrataSections(),
    });

    const s = await buildStrataSystemSuffix({
      experience: "strata_page",
      strataPageId: pageId,
      sbUserId: "owner-1",
      fetchPage,
    });

    expect(s).toContain("[Strata page grounding");
    expect(s).toContain("Test page");
  });

  test("strata_page skips grounding when owner mismatch", async () => {
    const pageId = "00000000-0000-4000-8000-000000000002";
    const fetchPage = async () => ({
      page: {
        id: pageId,
        title: "T",
        owner_id: "other",
        created_at: "",
        updated_at: "",
      },
      sections: buildDefaultStrataSections(),
    });

    const s = await buildStrataSystemSuffix({
      experience: "strata_page",
      strataPageId: pageId,
      sbUserId: "owner-1",
      fetchPage,
    });

    expect(s).not.toContain("[Strata page grounding");
  });
});

import { describe, expect, test } from "bun:test";

import {
  homepageHrefWithOptionalDraft,
  resolveHomepageCandidateByIndex,
  shouldAppendDraftForMatchKind,
  threadRowToCandidate,
  type HomepageRouteCandidate,
} from "@/lib/chat/thread-routing-candidates";

/**
 * Routing *quality* across thread / rabbit_hole / strata_page is LLM-dependent; track regressions
 * with a small offline eval or labeled prompts (not asserted here).
 */
describe("homepage routing resolution (index + draft helpers)", () => {
  const candidates: HomepageRouteCandidate[] = [
    threadRowToCandidate(
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Main",
        feature: "main",
        created_at: "",
        updated_at: "",
      } as any,
      "Summary one"
    ),
    {
      routeKey: "strata_page:22222222-2222-4222-8222-222222222222",
      kind: "strata_page",
      title: "Notes",
      feature: "strata_page",
      href: "/sandbox/prototypes/strata/22222222-2222-4222-8222-222222222222",
      summaryText: "Excerpt",
    },
  ];

  test("resolveHomepageCandidateByIndex returns hit or null", () => {
    expect(resolveHomepageCandidateByIndex(candidates, 0)?.title).toBe("Main");
    expect(resolveHomepageCandidateByIndex(candidates, 1)?.kind).toBe("strata_page");
    expect(resolveHomepageCandidateByIndex(candidates, 2)).toBeNull();
    expect(resolveHomepageCandidateByIndex(candidates, -1)).toBeNull();
    expect(resolveHomepageCandidateByIndex(candidates, null)).toBeNull();
    expect(resolveHomepageCandidateByIndex(candidates, 1.5)).toBeNull();
  });

  test("shouldAppendDraftForMatchKind excludes strata_page", () => {
    expect(shouldAppendDraftForMatchKind("thread")).toBe(true);
    expect(shouldAppendDraftForMatchKind("rabbit_hole")).toBe(true);
    expect(shouldAppendDraftForMatchKind("strata_page")).toBe(false);
  });

  test("homepageHrefWithOptionalDraft appends draft only for chat-like kinds", () => {
    const draft = "hello";

    expect(homepageHrefWithOptionalDraft("/chat/u", "thread", draft)).toContain("draft=hello");
    expect(
      homepageHrefWithOptionalDraft(
        "/sandbox/prototypes/strata/22222222-2222-4222-8222-222222222222",
        "strata_page",
        draft
      )
    ).toBe("/sandbox/prototypes/strata/22222222-2222-4222-8222-222222222222");
  });
});

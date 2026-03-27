import { describe, expect, test } from "bun:test";

import {
  appendDraftQueryParam,
  buildHomepageRoutingCandidatesFromParts,
  filterThreadCandidatesByCoalescence,
  rabbitHoleToCandidate,
  threadRowToCandidate,
  type ThreadListRow,
} from "@/lib/chat/thread-routing-candidates";

describe("thread-routing-candidates", () => {
  test("threadRowToCandidate maps path, feature, and summary", () => {
    const row = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Trip planning",
      feature: "main",
      path: "/chat/550e8400-e29b-41d4-a716-446655440000",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    } as ThreadListRow;

    const c = threadRowToCandidate(row, "User is organizing flights to Lisbon.");

    expect(c.routeKey).toBe(row.id);
    expect(c.kind).toBe("thread");
    expect(c.feature).toBe("main");
    expect(c.href).toBe("/chat/550e8400-e29b-41d4-a716-446655440000");
    expect(c.summaryText).toBe("User is organizing flights to Lisbon.");
    expect(c.title).toBe("Trip planning");
  });

  test("threadRowToCandidate uses default href when path empty", () => {
    const row = {
      id: "660e8400-e29b-41d4-a716-446655440001",
      title: "Notes",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    } as ThreadListRow;

    const c = threadRowToCandidate(row, null);

    expect(c.href).toBe(`/chat/${row.id}`);
    expect(c.feature).toBe("main");
    expect(c.summaryText).toBeNull();
  });

  test("rabbitHoleToCandidate maps session path and summary", () => {
    const c = rabbitHoleToCandidate({
      sessionId: "rh-1",
      rootQuestion: "Why is the sky blue?",
      rootTitle: "Sky color",
      summary: "Rayleigh scattering explains blue sky.",
    });

    expect(c.routeKey).toBe("rabbit_hole:rh-1");
    expect(c.kind).toBe("rabbit_hole");
    expect(c.feature).toBe("rabbit_hole");
    expect(c.href).toBe("/rabbitholes?sessionId=rh-1");
    expect(c.summaryText).toContain("Rayleigh");
    expect(c.title).toBe("Sky color");
  });

  test("filterThreadCandidatesByCoalescence off keeps only main threads", () => {
    const main = threadRowToCandidate(
      {
        id: "a0000000-0000-4000-8000-000000000001",
        title: "Main",
        feature: "main",
        created_at: "",
        updated_at: "",
      } as ThreadListRow,
      null
    );
    const arcadia = threadRowToCandidate(
      {
        id: "a0000000-0000-4000-8000-000000000002",
        title: "Arcadia",
        feature: "arcadia",
        path: "/sandbox/arcadia/a0000000-0000-4000-8000-000000000002",
        created_at: "",
        updated_at: "",
      } as ThreadListRow,
      null
    );
    const rh = rabbitHoleToCandidate({
      sessionId: "s1",
      rootQuestion: "Q",
    });

    const mixed = [main, arcadia, rh];
    const off = filterThreadCandidatesByCoalescence(mixed, false);

    expect(off).toEqual([main]);
  });

  test("filterThreadCandidatesByCoalescence on keeps all kinds", () => {
    const main = threadRowToCandidate(
      {
        id: "a0000000-0000-4000-8000-000000000003",
        title: "Main",
        feature: "main",
        created_at: "",
        updated_at: "",
      } as ThreadListRow,
      "s1"
    );
    const arcadia = threadRowToCandidate(
      {
        id: "a0000000-0000-4000-8000-000000000004",
        title: "Arcadia",
        feature: "arcadia",
        created_at: "",
        updated_at: "",
      } as ThreadListRow,
      "s2"
    );
    const rh = rabbitHoleToCandidate({ sessionId: "x", rootQuestion: "R" });

    const mixed = [main, arcadia, rh];
    const on = filterThreadCandidatesByCoalescence(mixed, true);

    expect(on).toEqual(mixed);
  });

  test("appendDraftQueryParam preserves existing query", () => {
    expect(appendDraftQueryParam("/rabbitholes?sessionId=1", "hello world")).toBe(
      "/rabbitholes?sessionId=1&draft=hello%20world"
    );
    expect(appendDraftQueryParam("/chat/uuid", "a")).toBe("/chat/uuid?draft=a");
  });

  test("buildHomepageRoutingCandidatesFromParts matches loader semantics (main-only, summaries)", () => {
    const mainId = "11111111-1111-4111-8111-111111111111";
    const arcId = "22222222-2222-4222-8222-222222222222";
    const threads = [
      {
        id: mainId,
        title: "Main chat",
        feature: "main",
        created_at: "",
        updated_at: "",
      } as ThreadListRow,
      {
        id: arcId,
        title: "Arcadia",
        feature: "arcadia",
        path: `/sandbox/arcadia/${arcId}`,
        created_at: "",
        updated_at: "",
      } as ThreadListRow,
    ];
    const summaryByThreadId = new Map<string, string | null>([
      [mainId, "Summary A"],
      [arcId, "Summary B"],
    ]);

    const off = buildHomepageRoutingCandidatesFromParts({
      threads,
      summaryByThreadId,
      coalescenceMode: false,
      rabbitHoleSources: [{ sessionId: "rh1", rootQuestion: "Q", summary: "RH" }],
    });

    expect(off.length).toBe(1);
    expect(off[0].routeKey).toBe(mainId);
    expect(off[0].summaryText).toBe("Summary A");

    const on = buildHomepageRoutingCandidatesFromParts({
      threads,
      summaryByThreadId,
      coalescenceMode: true,
      rabbitHoleSources: [{ sessionId: "rh1", rootQuestion: "Q", summary: "RH" }],
    });

    expect(on.length).toBe(3);
    expect(on.map((c) => c.feature).sort()).toEqual(["arcadia", "main", "rabbit_hole"]);
    const rh = on.find((c) => c.kind === "rabbit_hole");
    expect(rh?.summaryText).toBe("RH");
    expect(rh?.href).toContain("sessionId=rh1");
  });
});

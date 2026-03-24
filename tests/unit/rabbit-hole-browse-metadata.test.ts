import { describe, expect, test } from "bun:test";

import { mergeRabbitHoleBrowseMetadata } from "@/data/supabase/rabbitHoleBrowseMetadata";

const iso = "2025-03-01T12:00:00.000Z";

describe("mergeRabbitHoleBrowseMetadata", () => {
  test("sets rootTitle from position-0 path segment label and rootQuestion from session row", () => {
    const sessions = [
      { session_id: "s1", root_question: "user typed question", created_at: iso, updated_at: iso },
    ];
    const pathSegments = [
      { session_id: "s1", node_id: "n-root", position: 0, label: "Editorial headline" },
    ];

    const [meta] = mergeRabbitHoleBrowseMetadata(sessions, pathSegments, []);

    expect(meta.sessionId).toBe("s1");
    expect(meta.rootQuestion).toBe("user typed question");
    expect(meta.rootTitle).toBe("Editorial headline");
    expect(meta.pathLength).toBe(1);
  });

  test("does not set rootTitle when root label is empty or missing", () => {
    const sessions = [
      { session_id: "s1", root_question: "Q", created_at: iso, updated_at: iso },
    ];

    const emptyLabel = [
      { session_id: "s1", node_id: "n1", position: 0, label: "" },
    ];
    expect(mergeRabbitHoleBrowseMetadata(sessions, emptyLabel, [])[0].rootTitle).toBeUndefined();

    const missingLabel = [{ session_id: "s1", node_id: "n1", position: 0 }];
    expect(mergeRabbitHoleBrowseMetadata(sessions, missingLabel, [])[0].rootTitle).toBeUndefined();
  });

  test("does not use deeper segment label as rootTitle", () => {
    const sessions = [
      { session_id: "s1", root_question: "Q", created_at: iso, updated_at: iso },
    ];
    const pathSegments = [
      { session_id: "s1", node_id: "n0", position: 0, label: "" },
      { session_id: "s1", node_id: "n1", position: 1, label: "Branch only" },
    ];

    const [meta] = mergeRabbitHoleBrowseMetadata(sessions, pathSegments, []);

    expect(meta.rootTitle).toBeUndefined();
    expect(meta.pathLength).toBe(2);
  });

  test("assigns each session its own rootTitle", () => {
    const sessions = [
      { session_id: "a", root_question: "QA", created_at: iso, updated_at: iso },
      { session_id: "b", root_question: "QB", created_at: iso, updated_at: iso },
    ];
    const pathSegments = [
      { session_id: "a", node_id: "na", position: 0, label: "Title A" },
      { session_id: "b", node_id: "nb", position: 0, label: "Title B" },
    ];

    const out = mergeRabbitHoleBrowseMetadata(sessions, pathSegments, []);

    expect(out).toHaveLength(2);
    expect(out.find((m) => m.sessionId === "a")?.rootTitle).toBe("Title A");
    expect(out.find((m) => m.sessionId === "b")?.rootTitle).toBe("Title B");
  });

  test("pathLength counts all segments per session", () => {
    const sessions = [
      { session_id: "s1", root_question: "Q", created_at: iso, updated_at: iso },
    ];
    const pathSegments = [
      { session_id: "s1", node_id: "n0", position: 0, label: "R" },
      { session_id: "s1", node_id: "n1", position: 1, label: "X" },
      { session_id: "s1", node_id: "n2", position: 2, label: "Y" },
    ];

    expect(mergeRabbitHoleBrowseMetadata(sessions, pathSegments, [])[0].pathLength).toBe(3);
  });

  test("summary from first two key takeaways of root node only", () => {
    const sessions = [
      { session_id: "s1", root_question: "Q", created_at: iso, updated_at: iso },
    ];
    const pathSegments = [{ session_id: "s1", node_id: "root-id", position: 0, label: "T" }];
    const rootNodes = [
      {
        session_id: "s1",
        node_id: "root-id",
        key_takeaways: ["one", "two", "three"],
      },
    ];

    const [meta] = mergeRabbitHoleBrowseMetadata(sessions, pathSegments, rootNodes);

    expect(meta.summary).toBe("one • two");
  });

  test("ignores node rows that are not the session root", () => {
    const sessions = [
      { session_id: "s1", root_question: "Q", created_at: iso, updated_at: iso },
    ];
    const pathSegments = [{ session_id: "s1", node_id: "root-id", position: 0, label: "T" }];
    const rootNodes = [
      {
        session_id: "s1",
        node_id: "other-id",
        key_takeaways: ["wrong"],
      },
    ];

    const [meta] = mergeRabbitHoleBrowseMetadata(sessions, pathSegments, rootNodes);

    expect(meta.summary).toBeUndefined();
  });
});

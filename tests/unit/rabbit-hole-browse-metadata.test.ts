import { describe, expect, test } from "bun:test";

import {
  mergeRabbitHoleBrowseMetadata,
  rabbitHoleDisplayTitle,
} from "@/data/supabase/rabbitHoleBrowseMetadata";
import { resolveSidebarThreadRows } from "@/lib/sidebar/sidebar-thread-rows";

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

describe("rabbit-hole thread titles", () => {
  test("display title prefers the root article title, then the root question", () => {
    expect(rabbitHoleDisplayTitle({ rootTitle: " The fall of Rome ", rootQuestion: "why?" })).toBe(
      "The fall of Rome"
    );
    expect(rabbitHoleDisplayTitle({ rootTitle: "  ", rootQuestion: "Why did Rome fall?" })).toBe(
      "Why did Rome fall?"
    );
    expect(rabbitHoleDisplayTitle({ rootTitle: null, rootQuestion: "" })).toBeNull();
  });
});

describe("resolveSidebarThreadRows", () => {
  const base = { updated_at: iso, pinned: false, path: null };

  test("titles rabbit holes, drops unlinked ones, and strips the embed", () => {
    const rows = resolveSidebarThreadRows([
      { ...base, id: "t-main", title: "Groceries", feature: "main", rabbit_hole_sessions: [] },
      {
        ...base,
        id: "t-hole",
        title: null,
        feature: "rabbit_hole",
        rabbit_hole_sessions: [
          { root_question: "Why did Rome fall?", rabbit_hole_path_segments: [{ label: "The fall of Rome" }] },
        ],
      },
      {
        ...base,
        id: "t-hole-question",
        title: "Drawer chat title",
        feature: "rabbit_hole",
        rabbit_hole_sessions: [{ root_question: "How do octopi think?", rabbit_hole_path_segments: [] }],
      },
      { ...base, id: "t-orphan", title: null, feature: "rabbit_hole", rabbit_hole_sessions: [] },
    ]);

    expect(rows).toEqual([
      { ...base, id: "t-main", title: "Groceries", feature: "main" },
      { ...base, id: "t-hole", title: "The fall of Rome", feature: "rabbit_hole" },
      { ...base, id: "t-hole-question", title: "How do octopi think?", feature: "rabbit_hole" },
    ]);
  });
});

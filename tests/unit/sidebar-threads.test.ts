import { describe, expect, test } from "bun:test";

import {
  clampSidebarPageSize,
  decodeSidebarCursor,
  encodeSidebarCursor,
  isFirstSidebarPageKey,
  mergeSidebarPages,
  parseSidebarScope,
  patchSidebarPages,
  removeFromSidebarPages,
  sidebarCursorFilter,
  sidebarFeatureCondition,
  sidebarPageKey,
  toSidebarPage,
  toThreadLink,
  type SidebarThreadRow,
  type SidebarThreadsPage,
} from "@/lib/chat/sidebar-threads";

function row(id: string, updatedAt: string, extra: Partial<SidebarThreadRow> = {}): SidebarThreadRow {
  return { id, title: id, created_at: updatedAt, updated_at: updatedAt, pinned: false, ...extra };
}

describe("sidebar cursor", () => {
  test("round-trips the raw timestamp, keeping microseconds", () => {
    const cursor = { updatedAt: "2026-10-04T19:24:14.681234+00:00", id: "6f1c-thread_A" };

    expect(decodeSidebarCursor(encodeSidebarCursor(cursor))).toEqual(cursor);
  });

  test("rejects anything that could reach the filter as syntax", () => {
    const bad = [
      { updatedAt: "2026-10-04T00:00:00Z),owner_id.neq.x", id: "a" },
      { updatedAt: "2026-10-04T00:00:00Z", id: "a,owner_id.neq.x" },
      { updatedAt: "yesterday", id: "a" },
    ];

    for (const cursor of bad) {
      expect(decodeSidebarCursor(encodeSidebarCursor(cursor))).toBeNull();
    }
    expect(decodeSidebarCursor("not-base64-json")).toBeNull();
    expect(decodeSidebarCursor(btoa(JSON.stringify({ updatedAt: "x" })))).toBeNull();
    expect(decodeSidebarCursor("")).toBeNull();
    expect(decodeSidebarCursor(null)).toBeNull();
  });

  test("filters rows strictly after the cursor, quoting the timestamp", () => {
    expect(sidebarCursorFilter({ updatedAt: "2026-10-04T10:00:00.5+00:00", id: "t1" })).toBe(
      'updated_at.lt."2026-10-04T10:00:00.5+00:00",and(updated_at.eq."2026-10-04T10:00:00.5+00:00",id.lt.t1)'
    );
  });
});

describe("sidebar scope and page size", () => {
  test("main keeps main chats; all drops only memory ingest", () => {
    expect(sidebarFeatureCondition("main")).toEqual({ op: "eq", value: "main" });
    expect(sidebarFeatureCondition("all")).toEqual({ op: "neq", value: "memory-ingest" });
  });

  test("anything but all parses to main", () => {
    expect(parseSidebarScope("all")).toBe("all");
    expect(parseSidebarScope("ALL")).toBe("main");
    expect(parseSidebarScope(null)).toBe("main");
  });

  test("page size defaults, floors, and caps", () => {
    expect(clampSidebarPageSize(null)).toBe(50);
    expect(clampSidebarPageSize("0")).toBe(50);
    expect(clampSidebarPageSize("abc")).toBe(50);
    expect(clampSidebarPageSize("20")).toBe(20);
    expect(clampSidebarPageSize("500")).toBe(100);
  });
});

describe("toSidebarPage", () => {
  const rows = [row("c", "2026-10-03T00:00:03Z"), row("b", "2026-10-03T00:00:02Z"), row("a", "2026-10-03T00:00:01Z")];

  test("uses the extra row only to signal another page", () => {
    const page = toSidebarPage(rows, 2);

    expect(page.data.map((r) => r.id)).toEqual(["c", "b"]);
    expect(decodeSidebarCursor(page.nextCursor)).toEqual({ updatedAt: "2026-10-03T00:00:02Z", id: "b" });
  });

  test("has no cursor on the last page, and carries pinned when given", () => {
    const pinned = [row("p", "2026-10-01T00:00:00Z", { pinned: true })];

    expect(toSidebarPage(rows, 3, pinned)).toEqual({ data: rows, pinned, nextCursor: null });
    expect("pinned" in toSidebarPage(rows, 3)).toBe(false);
  });
});

describe("sidebarPageKey", () => {
  test("first page has no cursor; later pages follow the previous page", () => {
    const first = sidebarPageKey("main", 0, null);
    const second = sidebarPageKey("all", 1, { data: [], nextCursor: "abc" });

    expect(first).toBe("/api/chats?scope=main");
    expect(second).toBe("/api/chats?scope=all&cursor=abc");
    expect(isFirstSidebarPageKey(first)).toBe(true);
    expect(isFirstSidebarPageKey(second)).toBe(false);
  });

  test("stops after the last page", () => {
    expect(sidebarPageKey("main", 2, { data: [], nextCursor: null })).toBeNull();
  });
});

describe("mergeSidebarPages", () => {
  test("keeps the freshest copy of a thread that moved to the top", () => {
    const pages: SidebarThreadsPage[] = [
      { data: [row("moved", "2026-10-04T12:00:00Z", { title: "fresh" }), row("x", "2026-10-04T11:00:00Z")], nextCursor: "1" },
      { data: [row("y", "2026-10-02T00:00:00Z"), row("moved", "2026-10-01T00:00:00Z", { title: "stale" })], nextCursor: null },
    ];

    const { unpinned } = mergeSidebarPages(pages);

    expect(unpinned.map((r) => r.id)).toEqual(["moved", "x", "y"]);
    expect(unpinned[0]?.title).toBe("fresh");
  });

  test("splits on each row's pinned flag and orders newest first", () => {
    const pages: SidebarThreadsPage[] = [
      {
        pinned: [row("p-old", "2026-09-01T00:00:00Z", { pinned: true }), row("p-new", "2026-10-01T00:00:00Z", { pinned: true })],
        data: [row("u", "2026-10-02T00:00:00Z")],
        nextCursor: null,
      },
    ];

    const merged = mergeSidebarPages(pages);

    expect(merged.pinned.map((r) => r.id)).toEqual(["p-new", "p-old"]);
    expect(merged.unpinned.map((r) => r.id)).toEqual(["u"]);
  });

  test("orders microsecond timestamps in the same millisecond", () => {
    const { unpinned } = mergeSidebarPages([
      { data: [row("a", "2026-10-04T10:00:00.123001+00:00"), row("b", "2026-10-04T10:00:00.123009+00:00")], nextCursor: null },
    ]);

    expect(unpinned.map((r) => r.id)).toEqual(["b", "a"]);
  });

  test("is empty before the first page loads", () => {
    expect(mergeSidebarPages(undefined)).toEqual({ pinned: [], unpinned: [] });
  });
});

describe("cache patches", () => {
  const pages: SidebarThreadsPage[] = [
    { pinned: [row("p", "2026-10-01T00:00:00Z", { pinned: true })], data: [row("a", "2026-10-03T00:00:00Z")], nextCursor: "1" },
    { data: [row("b", "2026-09-01T00:00:00Z"), row("a", "2026-08-01T00:00:00Z")], nextCursor: null },
  ];

  test("pinning moves a thread between lists without a refetch", () => {
    const merged = mergeSidebarPages(patchSidebarPages(pages, "a", { pinned: true }));

    expect(merged.pinned.map((r) => r.id)).toEqual(["a", "p"]);
    expect(merged.unpinned.map((r) => r.id)).toEqual(["b"]);
  });

  test("renames every cached copy", () => {
    const patched = patchSidebarPages(pages, "a", { title: "Renamed" })!;
    const titles = patched.flatMap((page) => page.data).filter((r) => r.id === "a").map((r) => r.title);

    expect(titles).toEqual(["Renamed", "Renamed"]);
    expect(pages[0]!.data[0]!.title).toBe("a");
  });

  test("removes every cached copy, pinned or not", () => {
    const merged = mergeSidebarPages(removeFromSidebarPages(removeFromSidebarPages(pages, "a"), "p"));

    expect(merged.pinned).toEqual([]);
    expect(merged.unpinned.map((r) => r.id)).toEqual(["b"]);
  });

  test("leaves an unloaded cache alone", () => {
    expect(patchSidebarPages(undefined, "a", { pinned: true })).toBeUndefined();
    expect(removeFromSidebarPages(undefined, "a")).toBeUndefined();
  });
});

describe("toThreadLink", () => {
  test("prefers the stored path and flags missing titles", () => {
    expect(toThreadLink(row("r", "2026-10-01T00:00:00Z", { path: "/rabbitholes/r", title: " " }))).toMatchObject({
      href: "/rabbitholes/r",
      hasNoTitle: true,
    });
    expect(toThreadLink(row("m", "2026-10-01T00:00:00Z", { title: null }))).toMatchObject({
      href: "/chat/m",
      title: "Unknown title",
      hasNoTitle: true,
    });
  });
});

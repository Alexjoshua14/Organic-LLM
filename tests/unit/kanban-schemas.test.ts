import { describe, expect, test } from "bun:test";

import {
  KanbanCommandSchema,
  KanbanItemSchema,
  kanbanViewToMarkdown,
  peekKanbanCommandType,
  safeParseKanbanCommand,
} from "@/lib/schemas/kanban";
import {
  FIXTURE_INITIATE,
  FIXTURE_SHOW_ACTIVE_VIEW,
  FIXTURE_UPSERT,
} from "@/lib/schemas/kanban/fixtures";

describe("KanbanCommandSchema", () => {
  test("valid fixtures pass strict parse", () => {
    expect(KanbanCommandSchema.safeParse(FIXTURE_INITIATE).success).toBe(true);
    expect(KanbanCommandSchema.safeParse(FIXTURE_UPSERT).success).toBe(true);
    expect(KanbanCommandSchema.safeParse(FIXTURE_SHOW_ACTIVE_VIEW).success).toBe(true);
  });

  test("rejects too many items per upsert", () => {
    const bad = {
      type: "UPSERT_ITEMS",
      version: 1,
      items: Array.from({ length: 51 }, (_, i) => ({
        id: `i${i}`,
        title: `item ${i}`,
        status: "todo",
        priority: "medium",
        progress: 0,
      })),
    };
    expect(KanbanCommandSchema.safeParse(bad).success).toBe(false);
  });

  test("rejects unknown command type", () => {
    expect(KanbanCommandSchema.safeParse({ type: "NUKE", version: 1 }).success).toBe(false);
  });

  test("item schema applies priority/progress defaults", () => {
    const parsed = KanbanItemSchema.parse({ id: "x", title: "t", status: "todo" });
    expect(parsed.priority).toBe("medium");
    expect(parsed.progress).toBe(0);
  });
});

describe("safeParseKanbanCommand", () => {
  test("ok for a valid command", () => {
    const r = safeParseKanbanCommand(FIXTURE_UPSERT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.command.type).toBe("UPSERT_ITEMS");
  });

  test("not ok for garbage", () => {
    const r = safeParseKanbanCommand({ nope: true });
    expect(r.ok).toBe(false);
  });
});

describe("peekKanbanCommandType", () => {
  test("reads a known discriminator", () => {
    expect(peekKanbanCommandType({ type: "SHOW_VIEW" })).toBe("SHOW_VIEW");
  });

  test("undefined for unknown", () => {
    expect(peekKanbanCommandType({ type: "WAT" })).toBeUndefined();
    expect(peekKanbanCommandType(null)).toBeUndefined();
  });
});

describe("kanbanViewToMarkdown", () => {
  test("includes title and intent", () => {
    const md = kanbanViewToMarkdown(FIXTURE_SHOW_ACTIVE_VIEW.view);
    expect(md).toContain(FIXTURE_SHOW_ACTIVE_VIEW.view.title);
    expect(md).toContain("intent: active");
  });
});

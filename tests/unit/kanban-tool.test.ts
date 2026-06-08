import { describe, expect, test } from "bun:test";

import { createKanbanBoardTool, type KanbanStreamWriter } from "@/lib/llm/kanban-tool";
import type { KanbanCommand } from "@/lib/schemas/kanban";
import {
  FIXTURE_SHOW_ACTIVE_VIEW,
  FIXTURE_UPSERT,
} from "@/lib/schemas/kanban/fixtures";

function makeWriter() {
  const written: { type: string; data: KanbanCommand; transient?: boolean }[] = [];
  const writer: KanbanStreamWriter = {
    write: (part) => {
      written.push(part);
    },
  };
  return { writer, written };
}

describe("createKanbanBoardTool", () => {
  test("SHOW_VIEW returns an anchored view and streams the command", async () => {
    const { writer, written } = makeWriter();
    const t = createKanbanBoardTool({ writer });

    const result = await t.execute!(
      { command: FIXTURE_SHOW_ACTIVE_VIEW },
      {
        toolCallId: "tc1",
        messages: [],
      }
    );

    expect(result).toEqual({ kind: "kanban-view", view: FIXTURE_SHOW_ACTIVE_VIEW.view });
    expect(written).toHaveLength(1);
    expect(written[0].type).toBe("data-kanban");
    expect(written[0].transient).toBe(true);
    expect(written[0].data.type).toBe("SHOW_VIEW");
  });

  test("UPSERT_ITEMS returns an ack with count", async () => {
    const { writer, written } = makeWriter();
    const t = createKanbanBoardTool({ writer });

    const result = await t.execute!(
      { command: FIXTURE_UPSERT },
      { toolCallId: "tc2", messages: [] }
    );

    expect(result).toEqual({
      kind: "kanban-ack",
      applied: "UPSERT_ITEMS",
      count: FIXTURE_UPSERT.items.length,
    });
    expect(written[0].data.type).toBe("UPSERT_ITEMS");
  });

  test("works without a writer", async () => {
    const t = createKanbanBoardTool({});
    const result = await t.execute!(
      { command: FIXTURE_UPSERT },
      { toolCallId: "tc3", messages: [] }
    );
    expect(result.kind).toBe("kanban-ack");
  });
});

import { tool } from "ai";

import { createLogger } from "@/lib/logger";
import {
  KanbanCommandSchema,
  type KanbanBoardToolOutput,
  type KanbanCommand,
} from "@/lib/schemas/kanban";

const logger = createLogger("lib/llm/kanban-tool.ts");

export const KANBAN_BOARD_TOOL_NAME = "kanban_board";

/**
 * Minimal writer for the Ergon puppet channel. The runtime writer is the full
 * `ChatUIMessage` stream writer; this narrow type keeps the tool decoupled.
 */
export type KanbanStreamWriter = {
  write: (part: { type: "data-kanban"; data: KanbanCommand; transient?: boolean }) => void;
};

/**
 * Ergon kanban controller. The model drives a live, client-side board by emitting
 * schema-validated commands. Each call:
 *  1. Streams the validated command onto the `data-kanban` side channel (transient —
 *     the client reduces it into a localStorage-backed store).
 *  2. Returns a small output: an anchored view for SHOW_VIEW, else a mutation ack.
 *
 * Unlike one-shot gen-UI, multiple calls per turn are expected (init -> hydrate -> show).
 */
export function createKanbanBoardTool({ writer }: { writer?: KanbanStreamWriter }) {
  return tool({
    description:
      "Drive the user's live kanban board (Ergon chat style). Emit commands: INITIATE_KANBAN (create/replace board, shows a loading shell), UPSERT_ITEMS (add/update items, marks ready), UPDATE_ITEM / MOVE_ITEM / REMOVE_ITEM (mutate one item), SHOW_VIEW (present a saved, filtered view in the thread). On the first board-related turn call INITIATE_KANBAN then UPSERT_ITEMS. Map user directives to SHOW_VIEW with the right filter/intent. Respect schema caps.",
    inputSchema: KanbanCommandSchema,
    execute: async (command): Promise<KanbanBoardToolOutput> => {
      writer?.write({ type: "data-kanban", data: command, transient: true });

      logger.log("kanban_board", "command emitted", {
        event: "kanban_command",
        type: command.type,
      });

      if (command.type === "SHOW_VIEW") {
        return { kind: "kanban-view", view: command.view };
      }

      const count =
        command.type === "UPSERT_ITEMS"
          ? command.items.length
          : command.type === "INITIATE_KANBAN"
            ? (command.seedItems?.length ?? 0)
            : 1;

      return { kind: "kanban-ack", applied: command.type, count };
    },
  });
}

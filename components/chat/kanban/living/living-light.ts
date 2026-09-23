import type { KanbanBoardState } from "@/lib/kanban/store";

import { LIVING_SPARK_S } from "./living-board-timing";

import { KANBAN_STATUS_LABELS, type KanbanCommand } from "@/lib/schemas/kanban";

export type LivingLight = "trace" | "field" | "presence";

export const LIVING_LIGHTS: { id: LivingLight; label: string; blurb: string }[] = [
  {
    id: "trace",
    label: "Trace",
    blurb:
      "Light lives on the cards. Active cards breathe a lumen rim, a changed card washes warm, and the lane that receives it brightens.",
  },
  {
    id: "field",
    label: "Field",
    blurb:
      "Light lives in the glass. Warmth pools under Active work, red under Blocked, teal under Done, and every change blooms outward.",
  },
  {
    id: "presence",
    label: "Presence",
    blurb:
      "Light is the model. An orb breathes while it works, warms the card it's touching from below, and sends a spark to the card when the change lands.",
  },
];

export type LightBehavior = {
  /** Strength of the one-shot wash on a changed card. */
  wash: "strong" | "soft";
  /** Hold the wash until the presence spark arrives. */
  washDelayS: number;
  activeRim: "breathing" | "none";
  laneFlash: boolean;
  field: boolean;
  presence: boolean;
};

export const LIGHT_BEHAVIOR: Record<LivingLight, LightBehavior> = {
  trace: {
    wash: "strong",
    washDelayS: 0,
    activeRim: "breathing",
    laneFlash: true,
    field: false,
    presence: false,
  },
  field: {
    wash: "soft",
    washDelayS: 0,
    activeRim: "none",
    laneFlash: false,
    field: true,
    presence: false,
  },
  presence: {
    wash: "strong",
    washDelayS: LIVING_SPARK_S * 0.85,
    activeRim: "none",
    laneFlash: false,
    field: false,
    presence: true,
  },
};

/** Live signal from the chat stream: the model is mid tool call. */
export type KanbanActivity =
  | { phase: "idle" }
  | { phase: "working"; command: KanbanCommand; targetId?: string };

export const IDLE_ACTIVITY: KanbanActivity = { phase: "idle" };

/** Plain-language line for what the model is doing to the board. */
export function describeKanbanCommand(
  command: KanbanCommand,
  board: KanbanBoardState | undefined
): string {
  const titleOf = (id: string) => {
    const title = board?.items[id]?.title;

    return title ? `“${title}”` : "a card";
  };

  switch (command.type) {
    case "INITIATE_KANBAN":
      return `Setting up ${command.board.title}`;
    case "UPSERT_ITEMS": {
      const [first] = command.items;

      if (command.items.length === 1 && first) {
        return board?.items[first.id] ? `Updating ${titleOf(first.id)}` : `Adding “${first.title}”`;
      }

      return `Adding ${command.items.length} cards`;
    }
    case "UPDATE_ITEM":
      return command.patch.status
        ? `${titleOf(command.id)} → ${KANBAN_STATUS_LABELS[command.patch.status]}`
        : `Updating ${titleOf(command.id)}`;
    case "MOVE_ITEM":
      return `${titleOf(command.id)} → ${KANBAN_STATUS_LABELS[command.status]}`;
    case "REMOVE_ITEM":
      return `Removing ${titleOf(command.id)}`;
    case "SHOW_VIEW":
      return `Pulling up ${command.view.title}`;
  }
}

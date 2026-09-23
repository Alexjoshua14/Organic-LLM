/**
 * Hand-authored Ergon showcase session — fictional beta launch week.
 * Zero live API: commands are applied client-side via the kanban store.
 */

import type { ReplayChapter, ReplaySession, ReplayToolStep } from "./replay-timeline";

import { KANBAN_BOARD_TOOL_NAME } from "@/lib/llm/kanban-tool";
import { toKanbanToolOutput, type KanbanCommand, type KanbanView } from "@/lib/schemas/kanban";

export const ERGON_SHOWCASE_THREAD_ID = "showcase-ergon";

export const ERGON_FULL_BOARD_VIEW: KanbanView = {
  id: "view-board",
  title: "Full board",
  intent: "board",
  summary: "Everything in flight for the public beta.",
  groupBy: "status",
};

export const ERGON_NEXT_UP_VIEW: KanbanView = {
  id: "view-next-up",
  title: "Next up",
  intent: "next-up",
  summary: "Top of the to-do column by priority.",
  filter: {
    statuses: ["todo"],
    sort: "priority",
    limit: 3,
  },
  groupBy: "none",
};

function toolStep(command: KanbanCommand, toolCallId: string): ReplayToolStep {
  return {
    kind: "tool",
    toolName: KANBAN_BOARD_TOOL_NAME,
    toolCallId,
    input: { command },
    output: toKanbanToolOutput(command),
    effect: command,
  };
}

const CMD_INITIATE: KanbanCommand = {
  type: "INITIATE_KANBAN",
  version: 1,
  board: {
    id: "board-beta-launch",
    title: "Beta launch week",
    description: "Ship the public beta without dropping the ball.",
  },
};

/** First upsert — one card per starting column, so later cards land in columns that exist. */
const CMD_UPSERT_BATCH_1: KanbanCommand = {
  type: "UPSERT_ITEMS",
  version: 1,
  items: [
    {
      id: "task-checklist",
      title: "Launch day checklist",
      status: "backlog",
      priority: "low",
      progress: 0,
      tags: ["ops"],
    },
    {
      id: "task-signup-bug",
      title: "Fix signup redirect bug",
      status: "active",
      priority: "urgent",
      progress: 40,
      tags: ["eng"],
      notes: "Users bounce after OAuth on mobile Safari.",
    },
    {
      id: "task-landing-copy",
      title: "Rewrite landing hero copy",
      status: "todo",
      priority: "high",
      progress: 0,
      tags: ["marketing"],
    },
    {
      id: "task-waitlist",
      title: "Send waitlist invite email",
      status: "blocked",
      priority: "high",
      progress: 10,
      tags: ["growth"],
      notes: "Blocked on signup redirect.",
    },
  ],
};

/** Second upsert — cards animate into the existing To do column. */
const CMD_UPSERT_BATCH_2: KanbanCommand = {
  type: "UPSERT_ITEMS",
  version: 1,
  items: [
    {
      id: "task-analytics",
      title: "Wire beta analytics dashboard",
      status: "todo",
      priority: "medium",
      progress: 0,
      tags: ["eng"],
    },
    {
      id: "task-docs",
      title: "Polish onboarding docs",
      status: "todo",
      priority: "medium",
      progress: 0,
      tags: ["docs"],
    },
  ],
};

const CMD_SHOW_BOARD: KanbanCommand = {
  type: "SHOW_VIEW",
  version: 1,
  view: ERGON_FULL_BOARD_VIEW,
};

const CMD_MOVE_SIGNUP_DONE: KanbanCommand = {
  type: "MOVE_ITEM",
  version: 1,
  id: "task-signup-bug",
  status: "done",
};

const CMD_UPDATE_SIGNUP_PROGRESS: KanbanCommand = {
  type: "UPDATE_ITEM",
  version: 1,
  id: "task-signup-bug",
  patch: { progress: 100 },
};

const CMD_LANDING_IN_REVIEW: KanbanCommand = {
  type: "UPDATE_ITEM",
  version: 1,
  id: "task-landing-copy",
  patch: { status: "in_review", progress: 90 },
};

const CMD_UPSERT_PRESS_KIT: KanbanCommand = {
  type: "UPSERT_ITEMS",
  version: 1,
  items: [
    {
      id: "task-press-kit",
      title: "Assemble press kit",
      status: "todo",
      priority: "high",
      progress: 0,
      tags: ["marketing"],
      notes: "Logo pack, one-pager, founder bio.",
    },
  ],
};

const CMD_UNBLOCK_WAITLIST: KanbanCommand = {
  type: "UPDATE_ITEM",
  version: 1,
  id: "task-waitlist",
  patch: {
    status: "todo",
    priority: "urgent",
    progress: 20,
    notes: "Unblocked — signup redirect shipped.",
  },
};

const CMD_SHOW_NEXT_UP: KanbanCommand = {
  type: "SHOW_VIEW",
  version: 1,
  view: ERGON_NEXT_UP_VIEW,
};

const chapterPlan: ReplayChapter = {
  id: "plan",
  title: "Plan the week",
  caption:
    "The model opens a board, hydrates cards in batches, then anchors a full view in the thread.",
  user: "We're shipping a public beta Friday. Track: signup redirect bug, landing hero copy, waitlist invite (blocked on the bug), analytics dashboard, onboarding docs, and a launch-day checklist.",
  assistant: [
    {
      kind: "text",
      text: "I'll set up a **Beta launch week** board and pin the full view so we can watch it move.",
    },
    toolStep(CMD_INITIATE, "showcase-ergon-init"),
    toolStep(CMD_UPSERT_BATCH_1, "showcase-ergon-upsert-1"),
    toolStep(CMD_UPSERT_BATCH_2, "showcase-ergon-upsert-2"),
    toolStep(CMD_SHOW_BOARD, "showcase-ergon-show-board"),
    {
      kind: "text",
      text: "Board is live. Signup bug is active; waitlist stays blocked until that lands.",
    },
  ],
};

const chapterProgress: ReplayChapter = {
  id: "progress",
  title: "Report progress",
  caption:
    "Edits stream as data-kanban commands — the same board updates in-thread and in the live panel.",
  user: "Signup bug's fixed. Landing copy is in review. Add a press kit to the board.",
  assistant: [
    {
      kind: "text",
      text: "Updating the board — and I'll unblock the waitlist invite now that signup is green.",
    },
    toolStep(CMD_UPDATE_SIGNUP_PROGRESS, "showcase-ergon-signup-progress"),
    toolStep(CMD_MOVE_SIGNUP_DONE, "showcase-ergon-signup-done"),
    toolStep(CMD_UNBLOCK_WAITLIST, "showcase-ergon-unblock-waitlist"),
    toolStep(CMD_LANDING_IN_REVIEW, "showcase-ergon-landing-review"),
    toolStep(CMD_UPSERT_PRESS_KIT, "showcase-ergon-press-kit"),
    {
      kind: "text",
      text: "Signup is done, so the waitlist invite is unblocked at urgent priority. Landing copy is in review, and the press kit is on the to-do list.",
    },
  ],
};

const chapterNext: ReplayChapter = {
  id: "next",
  title: "Ask what's next",
  caption:
    "A filtered SHOW_VIEW recipe — not a snapshot — re-renders against the live client board.",
  user: "What should I pick up next?",
  assistant: [
    {
      kind: "text",
      text: "Here's the top of the to-do column by priority:",
    },
    toolStep(CMD_SHOW_NEXT_UP, "showcase-ergon-show-next"),
    {
      kind: "text",
      text: "Start with the waitlist invite, then the press kit, then analytics.",
    },
  ],
};

export const ergonShowcaseSession: ReplaySession = {
  id: "showcase-ergon",
  chapters: [chapterPlan, chapterProgress, chapterNext],
};

/** All kanban commands in apply order (for tests / store seeding). */
export const ergonShowcaseCommands: KanbanCommand[] = ergonShowcaseSession.chapters.flatMap(
  (chapter) =>
    chapter.assistant.flatMap((step) =>
      step.kind === "tool" && step.effect !== undefined ? [step.effect as KanbanCommand] : []
    )
);

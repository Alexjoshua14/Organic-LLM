import type {
  InitiateKanbanCommand,
  KanbanCommand,
  ShowViewCommand,
  UpsertItemsCommand,
} from "./command";

export const FIXTURE_INITIATE: InitiateKanbanCommand = {
  type: "INITIATE_KANBAN",
  version: 1,
  board: {
    id: "board-demo",
    title: "Ergon board",
    description: "Everything in flight for the gen-UI puppet milestone.",
  },
};

export const FIXTURE_UPSERT: UpsertItemsCommand = {
  type: "UPSERT_ITEMS",
  version: 1,
  items: [
    {
      id: "i1",
      title: "Define kanban command schema",
      status: "done",
      priority: "high",
      progress: 100,
      tags: ["schema"],
    },
    {
      id: "i2",
      title: "Wire puppet data channel",
      status: "active",
      priority: "urgent",
      progress: 60,
      tags: ["streaming"],
    },
    {
      id: "i3",
      title: "Build KanbanView component",
      status: "active",
      priority: "high",
      progress: 30,
      tags: ["ui"],
    },
    {
      id: "i4",
      title: "Style picker for new chats",
      status: "todo",
      priority: "medium",
      progress: 0,
    },
    {
      id: "i5",
      title: "Persisted board (v2)",
      status: "backlog",
      priority: "low",
      progress: 0,
      notes: "Swap localStorage for a server source.",
    },
    {
      id: "i6",
      title: "Review streaming UX with design",
      status: "in_review",
      priority: "medium",
      progress: 80,
    },
  ],
};

export const FIXTURE_SHOW_ACTIVE_VIEW: ShowViewCommand = {
  type: "SHOW_VIEW",
  version: 1,
  view: {
    id: "view-active",
    title: "What I'm working on now",
    intent: "active",
    summary: "Active and in-review work, highest priority first.",
    filter: {
      statuses: ["active", "in_review"],
      sort: "priority",
    },
    groupBy: "status",
  },
};

export const FIXTURE_SHOW_NEXT_UP_VIEW: ShowViewCommand = {
  type: "SHOW_VIEW",
  version: 1,
  view: {
    id: "view-next",
    title: "What I should pick up next",
    intent: "next-up",
    summary: "Top of the to-do column by priority.",
    filter: {
      statuses: ["todo"],
      sort: "priority",
      limit: 5,
    },
    groupBy: "none",
  },
};

/** Ordered command sequence for the sandbox walkthrough. */
export const FIXTURE_COMMAND_SEQUENCE: KanbanCommand[] = [
  FIXTURE_INITIATE,
  FIXTURE_UPSERT,
  FIXTURE_SHOW_ACTIVE_VIEW,
];

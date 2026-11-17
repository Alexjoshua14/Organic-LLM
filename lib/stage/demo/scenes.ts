import type { StageState, StageSubagent, StageWidget } from "../schema";

import { initializeStageViewLayouts, stageReservedRects } from "../layout";
import { emptyStageState } from "../schema";
import { ORGANIC_STAGE_VIEW } from "../view-schema";

// Prebuilt Stage compositions for the demo. Each scene is a full, schema-valid arrangement built
// from the same widget kinds the real designer produces, so the demo exercises the real renderer,
// layout engine and chrome. A cheap router model only picks which scene to show.

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LEFT = { x: 8, y: 4, w: 11, h: 18 } as const;
const RIGHT = { x: 20, y: 4, w: 12, h: 18 } as const;
const WIDE = { x: 8, y: 4, w: 24, h: 18 } as const;

export type StageDemoScene = {
  id: string;
  label: string;
  /** What the router reads to decide when this scene fits what the user said. */
  cue: string;
  reply: string;
  widgets: StageWidget[];
  /** Specialists shown mid-work, to demonstrate the agent tree and status line. */
  working?: { name: string; goal: string }[];
};

export const STAGE_DEMO_SCENES: StageDemoScene[] = [
  {
    id: "blank",
    label: "Blank stage",
    cue: "Reset, start over, clear the stage, or an open greeting with no specific task.",
    reply: "Cleared. Tell me what's on your mind and I'll find it a place.",
    widgets: [],
  },
  {
    id: "brain-dump",
    label: "Empty my head",
    cue: "The user pours out loose thoughts, worries, ideas or to-dos to get them organised and remembered.",
    reply:
      "I filed what you said into a living list and kept the one decision that needs thought as a note.",
    widgets: [
      {
        id: uid(1),
        kind: "collection",
        title: "On my mind",
        rect: LEFT,
        items: [
          "Book flights before prices climb",
          "Reply to Dana about the offsite",
          "Draft the quarterly goals",
          "Call the landlord about the heater",
        ].map((text, i) => ({
          id: uid(100 + i),
          text,
          at: "2026-11-14T09:00:00.000Z",
          ...(i === 3 ? { done: true } : {}),
        })),
      },
      {
        id: uid(2),
        kind: "note",
        title: "Decision to make",
        rect: RIGHT,
        text: "## Offsite dates\n\nTwo options are open:\n\n- **Early December:** cheaper, but the goals draft is not ready\n- **January:** more time to prepare, flights cost more\n\nLeaning toward **January** unless the budget changes.",
      },
    ],
  },
  {
    id: "map-idea",
    label: "Map an idea",
    cue: "The user wants to understand, map, diagram or structure an idea, system, process or concept.",
    reply: "Here's the shape of it as a diagram, with the trade-offs written beside it.",
    widgets: [
      {
        id: uid(3),
        kind: "mermaid",
        title: "How a request flows",
        rect: LEFT,
        code: "flowchart TD\n  A[You speak or type] --> B{Organic decides}\n  B -->|answer| C[Reply]\n  B -->|needs layout| D[Designer]\n  B -->|needs depth| E[Specialists]\n  D --> F[Stage pieces]\n  E --> F",
      },
      {
        id: uid(4),
        kind: "block",
        title: "Trade-offs",
        rect: RIGHT,
        block: {
          type: "answer-card",
          version: 1,
          title: "Why separate the designer?",
          tldr: "Conversation stays fast while layout work happens beside it.",
          keyPoints: [
            "Replies never wait on layout",
            "Failed layouts retry without losing the chat",
            "Specialists can fill pieces in parallel",
          ],
        },
      },
    ],
  },
  {
    id: "plan-dinner",
    label: "Plan a dinner",
    cue: "Cooking, recipes, meal planning, groceries, or shopping lists.",
    reply: "A recipe, the shopping list for it, and the evening laid out in order.",
    widgets: [
      {
        id: uid(5),
        kind: "recipe",
        title: "Roasted squash soup",
        rect: LEFT,
        recipe: {
          type: "recipe-card",
          version: 1,
          title: "Roasted squash soup",
          servings: "4",
          duration: "50 min",
          ingredients: [
            { name: "butternut squash", quantity: "1", unit: "large" },
            { name: "onion", quantity: "1" },
            { name: "vegetable stock", quantity: "750", unit: "ml" },
          ],
          steps: [
            "Roast the squash until soft and caramelised.",
            "Soften the onion, add squash and stock, simmer 15 minutes.",
            "Blend smooth and season.",
          ],
        },
      },
      {
        id: uid(6),
        kind: "block",
        title: "Shopping",
        rect: RIGHT,
        block: {
          type: "shopping-list",
          version: 1,
          title: "Shopping list",
          groups: [
            {
              category: "Produce",
              items: [
                { name: "Butternut squash", quantity: "1", status: "need" },
                { name: "Onion", quantity: "1", status: "have" },
              ],
            },
            {
              category: "Pantry",
              items: [{ name: "Vegetable stock", quantity: "750", unit: "ml", status: "need" }],
            },
          ],
        },
      },
    ],
  },
  {
    id: "read-the-web",
    label: "Read a page beside notes",
    cue: "The user wants to look at, read, compare against or work alongside a web page or documentation.",
    reply:
      "The page sits on the stage, with a plan beside it so you can work without switching tabs.",
    widgets: [
      {
        id: uid(7),
        kind: "web",
        title: "Spatial computing",
        rect: { x: 8, y: 4, w: 17, h: 18 },
        url: "https://en.wikipedia.org/wiki/Spatial_computing",
      },
      {
        id: uid(8),
        kind: "block",
        title: "Reading plan",
        rect: { x: 26, y: 4, w: 6, h: 18 },
        block: {
          type: "plan-timeline",
          version: 1,
          title: "Reading plan",
          steps: [
            { id: "a", label: "Skim the overview", status: "done" },
            { id: "b", label: "Note the key terms", status: "now", estimate: "10 min" },
            { id: "c", label: "Write a summary", status: "next" },
          ],
        },
      },
    ],
  },
  {
    id: "specialists",
    label: "Specialists at work",
    cue: "A big or multi-part task that deserves parallel specialists, research, or a deep dive.",
    reply: "I've put two specialists on this. Their pieces will arrive as they finish.",
    working: [
      { name: "Researcher", goal: "Compare three approaches" },
      { name: "Planner", goal: "Draft a two-week plan" },
    ],
    widgets: [
      {
        id: uid(9),
        kind: "note",
        title: "Brief",
        rect: WIDE,
        text: "## What I'm exploring\n\nTwo specialists are working in parallel: one compares approaches, one drafts a plan. This note is the shared brief they report back to.",
      },
    ],
  },
];

export const stageDemoScene = (id: string) => STAGE_DEMO_SCENES.find((scene) => scene.id === id);

/** The fixed id of each scene's reply, so replaying a scene replaces rather than stacks messages. */
function subagents(scene: StageDemoScene, at: string): StageSubagent[] | undefined {
  return scene.working?.map((agent, slot) => ({
    ...agent,
    id: uid(900 + slot),
    status: "working" as const,
    startedAt: at,
    result: null,
    slot,
    memory: false,
    webSearch: false,
  }));
}

/** The next demo state: the scene's arrangement on top of the running conversation. */
export function stageDemoState(
  previous: StageState,
  scene: StageDemoScene,
  userText?: string
): StageState {
  const at = new Date().toISOString();
  const base: StageState = {
    ...emptyStageState(),
    revision: previous.revision + 1,
    updatedAt: at,
    messages: [
      ...previous.messages,
      ...(userText ? [{ id: crypto.randomUUID(), role: "user" as const, text: userText }] : []),
      { id: crypto.randomUUID(), role: "assistant" as const, text: scene.reply },
    ].slice(-24),
    summary: previous.summary,
    subagents: subagents(scene, at),
  };

  return {
    ...base,
    widgets: initializeStageViewLayouts(scene.widgets, stageReservedRects(base)),
    // As the real designer does: a new arrangement opens the overview so its arrival is seen.
    viewCommand: {
      id: crypto.randomUUID(),
      target: scene.widgets.length ? { kind: "overview", id: null } : ORGANIC_STAGE_VIEW,
    },
  };
}

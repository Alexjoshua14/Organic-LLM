import type { GenUIBlock } from "@/lib/schemas/gen-ui";

export const WELCOME_GEN_UI_ANSWER_CARD: GenUIBlock = {
  type: "answer-card",
  version: 1,
  title: "How memory surfaces in chat",
  tldr: "Memory shows up per thread, not as a separate sidebar—retrieval calls leave traces you can inspect.",
  keyPoints: [
    "Episodic recall runs before the model answers when memory is enabled.",
    "Tool fingerprints show which retrievals ran on each turn.",
    "Summaries persist encrypted; you browse them in the memory lens.",
  ],
};

export const WELCOME_GEN_UI_DECISION_MATRIX: GenUIBlock = {
  type: "decision-matrix",
  version: 1,
  question: "Which surface fits this work?",
  options: [
    { id: "chat", name: "Chat", note: "Daily assistant" },
    { id: "holes", name: "Rabbit holes", note: "Branching research" },
    { id: "strata", name: "Strata", note: "Editorial canvas" },
  ],
  criteria: [
    { id: "depth", label: "Depth" },
    { id: "speed", label: "Speed" },
    { id: "memory", label: "Memory" },
  ],
  scores: {
    chat: {
      depth: { value: 3 },
      speed: { value: 5 },
      memory: { value: 5 },
    },
    holes: {
      depth: { value: 5 },
      speed: { value: 3 },
      memory: { value: 4 },
    },
    strata: {
      depth: { value: 4 },
      speed: { value: 2 },
      memory: { value: 3 },
    },
  },
  recommendation: {
    optionId: "holes",
    rationale: "Best for cited branches without losing the thread spine.",
  },
};

export const WELCOME_GEN_UI_PLAN_TIMELINE: GenUIBlock = {
  type: "plan-timeline",
  version: 1,
  title: "Ship a research thread",
  steps: [
    { id: "s1", label: "Frame the question", status: "done" },
    {
      id: "s2",
      label: "Branch into rabbit holes",
      status: "now",
      estimate: "2d",
      substeps: [
        { label: "Generate nodes", done: true },
        { label: "Attach sources", done: false },
      ],
    },
    { id: "s3", label: "Promote stable ideas to chat", status: "next", dependsOn: ["s2"] },
    { id: "s4", label: "Export to Strata", status: "next", dependsOn: ["s3"] },
  ],
};

/** Carousel order for the welcome Gen UI morph illustration. */
export const WELCOME_GEN_UI_BLOCKS: GenUIBlock[] = [
  WELCOME_GEN_UI_ANSWER_CARD,
  WELCOME_GEN_UI_DECISION_MATRIX,
  WELCOME_GEN_UI_PLAN_TIMELINE,
];

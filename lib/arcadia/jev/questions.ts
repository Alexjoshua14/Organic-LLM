import type {
  JevBooleanQuestion,
  JevChoiceQuestion,
  JevQuestionSet,
} from "@/lib/llm/jev-evaluate";
import type { JevIntentKey, JevResponseFormat, JevToolKey } from "./types";

/**
 * The questions Jev answers about each user message in Arcadia Jev mode.
 *
 * Intent is a single choice question. TypeSafe allows up to 255 options; this list uses 13
 * because every option has to change the reply (its `guidance` goes into the system prompt).
 * An intent that would get the same guidance as another is merged into it. Adding options costs
 * prompt tokens on every pass and spreads probability thinner, so add one only with a new
 * behavior attached.
 */
export type JevIntentDefinition = {
  /** Short name for the turn chip. */
  label: string;
  /** What Jev reads to decide; written as a description of the message. */
  criterion: string;
  /** One line for the LLM's system prompt when this intent wins. */
  guidance: string;
};

export const JEV_INTENTS: Record<JevIntentKey, JevIntentDefinition> = {
  quick_answer: {
    label: "Quick answer",
    criterion: "A direct question with a short, checkable answer: a fact, a definition, a how-to step.",
    guidance: "Lead with the answer in one or two sentences. Add detail only if it changes the answer.",
  },
  explain: {
    label: "Explain",
    criterion: "Wants to understand a concept, a mechanism, or why something is the way it is.",
    guidance: "Build understanding: the core idea first, then one concrete example or analogy.",
  },
  research: {
    label: "Research",
    criterion: "Wants current, external, or source-backed information gathered and summarized.",
    guidance: "Ground claims in sources you retrieve this turn and say where each key fact came from.",
  },
  brainstorm: {
    label: "Brainstorm",
    criterion: "Wants ideas, options, names, or possibilities generated.",
    guidance: "Offer several distinct options with a few words on each. Don't converge on one unless asked.",
  },
  decide: {
    label: "Decide",
    criterion: "Weighing options or asking which to choose; wants a recommendation.",
    guidance: "Recommend one option and give the deciding reason. Name the runner-up and when it would win.",
  },
  plan: {
    label: "Plan",
    criterion: "Wants steps, a schedule, or a sequence for getting something done.",
    guidance: "Give ordered steps. Flag dependencies and the first step to take now.",
  },
  write_edit: {
    label: "Write / edit",
    criterion: "Wants text drafted, rewritten, shortened, translated, or polished.",
    guidance: "Produce the text itself. Keep commentary to a line, after the text.",
  },
  code: {
    label: "Code",
    criterion: "Programming: write, review, explain, or debug code, queries, or configuration.",
    guidance: "Code first and exact. State assumptions about versions or environment in one line.",
  },
  visualize: {
    label: "Visualize",
    criterion: "Wants a diagram, map, chart, table, or other structured visual.",
    guidance: "Prefer a diagram or structured block over prose; keep surrounding text to a caption.",
  },
  deep_dive: {
    label: "Deep dive",
    criterion: "Wants to explore a topic in depth across several angles, or go down a rabbit hole.",
    guidance: "Give a compact overview and the most interesting threads to pull. Offer a rabbit hole for depth.",
  },
  task_capture: {
    label: "Task",
    criterion: "Wants something remembered, tracked, scheduled, or added to or changed on a todo list.",
    guidance: "Capture or update it with the task tool, then confirm in one line.",
  },
  conversation: {
    label: "Conversation",
    criterion: "Social, reflective, or emotional conversation: sharing thoughts, feelings, or news.",
    guidance: "Reply like a thoughtful person: match the tone, no lists or headings, ask at most one question.",
  },
  feedback: {
    label: "Feedback",
    criterion: "Reacting to, correcting, or rating the assistant's previous reply.",
    guidance: "Take the correction on board and revise. Don't re-explain what the user already rejected.",
  },
};

export const JEV_RESPONSE_FORMAT_LABELS: Record<JevResponseFormat, string> = {
  text: "Text",
  voice: "Voice",
  tool_result: "Tool result",
};

const RESPONSE_FORMAT_CRITERIA: Record<JevResponseFormat, string> = {
  text: "A written reply in the chat. The default for almost every message.",
  voice:
    "A spoken reply: the user asks to hear it, to have it read or said out loud, or says they can't read the screen right now.",
  tool_result:
    "Only the artifact: the user asks for a diagram, board, list, rabbit hole, or other tool output and no prose around it.",
};

export type JevToolDefinition = {
  /** Short name for the turn chip. */
  label: string;
  question: JevBooleanQuestion;
};

export const JEV_TOOLS: Record<JevToolKey, JevToolDefinition> = {
  web_search: {
    label: "Web search",
    question: {
      type: "boolean",
      instructions:
        "Would a good reply need information from the web: recent events, prices, availability, facts that may have changed, or specific sources and links?",
    },
  },
  memory_search: {
    label: "Memory",
    question: {
      type: "boolean",
      instructions:
        "Would a good reply need the user's own history, preferences, or details from past conversations that are not in this thread?",
    },
  },
  mermaid_diagram: {
    label: "Diagram",
    question: {
      type: "boolean",
      instructions:
        "Did the user ask for a diagram, or would a flowchart, sequence diagram, mind map, or architecture diagram clearly help?",
    },
  },
  gen_ui: {
    label: "Structured block",
    question: {
      type: "boolean",
      instructions:
        "Would a structured block help: a comparison or decision matrix, a step timeline, a multi-point answer card, a recipe, or a shopping list?",
    },
  },
  restaurant_lookup: {
    label: "Restaurant lookup",
    question: {
      type: "boolean",
      instructions:
        "Is the user asking about a specific restaurant, café, or bar: its hours, menu, reviews, or location?",
    },
  },
  rabbit_hole: {
    label: "Rabbit hole",
    question: {
      type: "boolean",
      instructions:
        "Does the user want to start a deep, multi-part exploration of a topic, for example by asking to go down a rabbit hole, do a deep dive, or explore something in depth?",
    },
  },
  task_management: {
    label: "Tasks",
    question: {
      type: "boolean",
      instructions:
        "Is the user asking to add, update, complete, or review tasks or todos, or to be reminded of something?",
    },
  },
  chat_history: {
    label: "Chat history",
    question: {
      type: "boolean",
      instructions:
        "Does the message refer back to something said earlier in this conversation that may not be in the recent messages shown?",
    },
  },
};

/** Phrased so "yes" is the actionable outcome: answer with an acknowledgement only. */
export const JEV_NO_REPLY_QUESTION: JevBooleanQuestion = {
  type: "boolean",
  instructions:
    "Does the latest user message need no reply at all? Read it in the context of the recent conversation.",
  criteria: {
    true: "No reply is wanted: the message is rhetorical, a sign-off, a thank-you or 'ok' that closes the exchange, a note to self, or venting that asks not to be answered.",
    false:
      "A reply is wanted or would be welcome: it asks, requests, or invites anything, even implicitly, or answers a question the assistant just asked.",
  },
};

export const JEV_INTENT_QUESTION: JevChoiceQuestion<JevIntentKey> = {
  type: "choice",
  instructions: "What is the user's main intent in their latest message?",
  criteria: Object.fromEntries(
    Object.entries(JEV_INTENTS).map(([key, def]) => [key, def.criterion])
  ) as Record<JevIntentKey, string>,
};

export const JEV_RESPONSE_FORMAT_QUESTION: JevChoiceQuestion<JevResponseFormat> = {
  type: "choice",
  instructions: "How does the user want the assistant's reply to this message delivered?",
  criteria: RESPONSE_FORMAT_CRITERIA,
};

/** Question key for a tool group in an analysis request. */
export function jevToolQuestionKey(tool: JevToolKey): `tool_${JevToolKey}` {
  return `tool_${tool}`;
}

/** Every question one analysis pass asks, keyed for `evaluateWithJev`. */
export function buildJevAnalysisQuestions() {
  const toolQuestions = Object.fromEntries(
    (Object.keys(JEV_TOOLS) as JevToolKey[]).map((tool) => [
      jevToolQuestionKey(tool),
      JEV_TOOLS[tool].question,
    ])
  ) as Record<`tool_${JevToolKey}`, JevBooleanQuestion>;

  return {
    intent: JEV_INTENT_QUESTION,
    responseFormat: JEV_RESPONSE_FORMAT_QUESTION,
    noReplyNeeded: JEV_NO_REPLY_QUESTION,
    ...toolQuestions,
  } satisfies JevQuestionSet;
}

export type JevAnalysisQuestions = ReturnType<typeof buildJevAnalysisQuestions>;

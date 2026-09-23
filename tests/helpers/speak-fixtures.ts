import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { AmbientContextDeps } from "@/lib/speak/ambient-context";

export const SPEAK_TEST_OWNER = "owner-1";
export const RABBIT_HOLE_SESSION_ID = "00000000-0000-4000-8000-000000000000";

/**
 * A three-node hole: "City hum" with two branches, "Mains hum" (open) and "Traffic rumble". Each
 * node's summary is distinctive so a test can tell which one reached the model.
 */
export function rabbitHoleFixture(): RabbitHoleSession {
  return {
    sessionId: RABBIT_HOLE_SESSION_ID,
    rootQuestion: "Why do cities hum?",
    rootNodeId: "n1",
    path: [
      { nodeId: "n1", label: "City hum", parentNodeId: null },
      { nodeId: "n2", label: "Mains hum", parentNodeId: "n1" },
      { nodeId: "n3", label: "Traffic rumble", parentNodeId: "n1" },
    ],
    activeNodeId: "n2",
    edges: [
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
    ],
    nodesById: {
      n1: {
        id: "n1",
        rawPrompt: "",
        userQuestion: "Why do cities hum?",
        title: "City hum",
        summary: "Transformers and traffic dominate the low end.",
        keyTakeaways: [],
        articleHtml: "<section><p>City hum</p></section>",
        createdAt: "2026-01-01",
      },
      n2: {
        id: "n2",
        rawPrompt: "",
        userQuestion: "What is mains hum?",
        title: "Mains hum",
        summary: "50/60Hz leakage from grid infrastructure.",
        keyTakeaways: [],
        articleHtml: "<section><p>Mains hum</p></section>",
        createdAt: "2026-01-01",
      },
      n3: {
        id: "n3",
        rawPrompt: "",
        userQuestion: "How loud is traffic at night?",
        title: "Traffic rumble",
        summary: "Tyre noise carries further once the air cools.",
        keyTakeaways: [],
        articleHtml: "<section><p>Traffic rumble</p></section>",
        createdAt: "2026-01-01",
      },
    },
    createdAt: "2026-01-01",
  } as unknown as RabbitHoleSession;
}

/**
 * Ambient-context deps where every surface belongs to {@link SPEAK_TEST_OWNER}. The rabbit hole is
 * read through `getSession` on each call, so a test can change it mid-flight — an article landing,
 * say — and the next push sees the new state.
 */
export function rabbitHoleAmbientDeps(
  getSession: () => RabbitHoleSession = rabbitHoleFixture,
  overrides: Partial<AmbientContextDeps> = {}
): AmbientContextDeps {
  return {
    getThreadOwnerContext: async () => ({
      data: { threadId: "t1", ownerId: SPEAK_TEST_OWNER },
      error: null,
    }),
    getConversationSummary: async () => ({ data: null, error: null }),
    getStrataPageById: async () => null,
    getSessionById: async () => ({ data: getSession(), error: null }),
    getRabbitHoleSessionOwnerId: async () => SPEAK_TEST_OWNER,
    ...overrides,
  } as AmbientContextDeps;
}

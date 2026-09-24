import type { UIMessage } from "ai";
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

export const CHAT_THREAD_ID = "11111111-1111-4111-8111-111111111111";

/** A chat thread as the server holds it: title, messages (chronological), rolling summary. */
export type ChatThreadFixture = {
  title: string | null;
  messages: UIMessage[];
  summary: string | null;
};

export function chatMessage(id: string, role: "user" | "assistant", text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] } as UIMessage;
}

/** "Espresso grinders": two exchanges and a summary, each line distinctive enough to assert on. */
export function chatThreadFixture(): ChatThreadFixture {
  return {
    title: "Espresso grinders",
    messages: [
      chatMessage("m1", "user", "Should I get a flat or conical burr grinder?"),
      chatMessage("m2", "assistant", "Flat burrs give a more uniform grind; conicals are quieter."),
      chatMessage("m3", "user", "Which one for light roasts?"),
      chatMessage("m4", "assistant", "Flat burrs — they bring out clarity in light roasts."),
    ],
    summary: "Comparing flat and conical burr grinders for home espresso.",
  };
}

/**
 * Ambient-context deps where every surface belongs to {@link SPEAK_TEST_OWNER}. The rabbit hole and
 * the chat are read through getters on each call, so a test can change them mid-flight — an
 * article landing, a new exchange — and the next push sees the new state.
 */
export function speakAmbientDeps(
  sources: { rabbitHole?: () => RabbitHoleSession; chat?: () => ChatThreadFixture } = {},
  overrides: Partial<AmbientContextDeps> = {}
): AmbientContextDeps {
  const rabbitHole = sources.rabbitHole ?? rabbitHoleFixture;
  const chat = sources.chat ?? chatThreadFixture;

  return {
    getThreadOwnerContext: async (id: string) => ({
      data: { threadId: id, ownerId: SPEAK_TEST_OWNER },
      error: null,
    }),
    getThreadTitle: async () => ({ data: chat().title, error: null }),
    getNMessages: async (_id: string, limit?: number) => ({
      data: chat().messages.slice(-(limit ?? 20)),
      error: null,
    }),
    getConversationSummary: async () => ({ data: chat().summary, error: null }),
    getStrataPageById: async () => null,
    getSessionById: async () => ({ data: rabbitHole(), error: null }),
    getRabbitHoleSessionOwnerId: async () => SPEAK_TEST_OWNER,
    ...overrides,
  } as AmbientContextDeps;
}

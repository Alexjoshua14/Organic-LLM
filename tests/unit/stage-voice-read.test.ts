import type { UIMessage } from "ai";
import type { StageState, StageWidget } from "@/lib/stage/schema";
import type { StagePresentation } from "@/lib/stage/view-schema";

import { describe, expect, test } from "bun:test";

import { buildAmbientContext, SPEAK_AMBIENT_MAX_TOKENS } from "@/lib/speak/ambient-context";
import { estimateSpeakTokens, SPEAK_CHARS_PER_TOKEN } from "@/lib/speak/token-limit";
import { emptyStageState } from "@/lib/stage/schema";
import { stageVoiceContext } from "@/lib/stage/voice";
import {
  buildStageRead,
  STAGE_READ_MAX_CHARS,
  stageAmbientContext,
  type StageReadDeps,
} from "@/lib/stage/voice-read";

const OWNER = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const DIAGRAM_ID = "33333333-3333-4333-8333-333333333333";
const CHAT_ID = "44444444-4444-4444-8444-444444444444";
const THREAD_ID = "55555555-5555-4555-8555-555555555555";
const RECIPE_ID = "66666666-6666-4666-8666-666666666666";

const rect = { x: 8, y: 4, w: 11, h: 16 };
const overview: StagePresentation = {
  view: { kind: "overview", id: null },
  width: 1200,
  height: 700,
  composerHeight: 80,
};

function stage(overrides: Partial<StageState> = {}): StageState {
  const widgets: StageWidget[] = [
    {
      id: NOTE_ID,
      kind: "note",
      title: "Onboarding plan",
      rect,
      text: "Step one: let people talk first. Step two: ask for a name only after the first useful answer.",
    },
    {
      id: DIAGRAM_ID,
      kind: "mermaid",
      title: "Flow",
      rect: { x: 20, y: 4, w: 11, h: 16 },
      code: "flowchart TD\n  A[Talk] --> B[Answer]\n  B --> C[Ask name]",
    },
    { id: CHAT_ID, kind: "chat", title: "Research chat", rect, threadId: THREAD_ID },
    {
      id: RECIPE_ID,
      kind: "recipe",
      title: "Weeknight dal",
      rect,
      recipe: {
        type: "recipe-card",
        version: 1,
        title: "Weeknight dal",
        servings: "4",
        ingredients: [{ name: "red lentils", quantity: "1", unit: "cup" }],
        steps: ["Rinse the lentils.", "Simmer for 20 minutes."],
      },
    } as StageWidget,
  ];

  return {
    ...emptyStageState(),
    widgets,
    messages: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        role: "user",
        text: "Make me a plan for onboarding.",
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        role: "assistant",
        text: "Here is a plan and a flow diagram.",
      },
    ],
    summary: "The user is designing onboarding for a voice product.",
    subagents: [
      {
        id: "99999999-9999-4999-8999-999999999999",
        name: "Researcher",
        goal: "Find onboarding patterns in voice apps.",
        status: "done",
        startedAt: new Date().toISOString(),
        result: "Most voice apps defer sign-up until after the first exchange.",
        memory: false,
        webSearch: true,
      },
    ],
    ...overrides,
  };
}

function chatMessage(role: "user" | "assistant", text: string): UIMessage {
  return { id: `${role}-${text.length}`, role, parts: [{ type: "text", text }] } as UIMessage;
}

const deps = (overrides: Partial<StageReadDeps> = {}): StageReadDeps => ({
  getThreadScreen: async () => ({
    data: {
      title: "Research",
      summary: "Comparing onboarding flows.",
      messages: [
        chatMessage("user", "What do voice apps do first?"),
        chatMessage("assistant", "They greet and ask an open question."),
      ],
    },
    error: null,
  }),
  ...overrides,
});

const ambientBudget = SPEAK_AMBIENT_MAX_TOKENS * SPEAK_CHARS_PER_TOKEN;

function crowdedStage(): StageState {
  const long = "Detailed reasoning about the plan. ".repeat(120);

  return stage({
    widgets: Array.from({ length: 30 }, (_, i) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
      kind: "note" as const,
      title: `Note ${i}`,
      rect,
      text: long,
    })),
    summary: long.slice(0, 6000),
    messages: stage().messages.map((m) => ({ ...m, text: long.slice(0, 8000) })),
  });
}

describe("Stage [Screen] item", () => {
  test("the full Stage JSON is far over the ambient budget, which is why it used to vanish", () => {
    expect(estimateSpeakTokens(stageVoiceContext(stage(), overview))).toBeGreaterThan(
      SPEAK_AMBIENT_MAX_TOKENS
    );
  });

  test("carries the visible pieces with previews instead of only a header", async () => {
    const body = (
      await buildAmbientContext(
        { ownerId: OWNER, surface: { kind: "stage", presentation: overview } },
        {
          getThreadScreen: async () => ({ data: null, error: "not-found" }),
          getStrataPageById: async () => null,
          getSessionById: async () => ({ data: null, error: null }),
          getRabbitHoleSessionOwnerId: async () => null,
          readStage: async () => ({ state: stage(), raw: "" }),
        } as never
      )
    ).body;

    expect(body).toContain("Onboarding plan");
    expect(body).toContain("let people talk first");
    expect(body).toContain(NOTE_ID);
    expect(body).toContain("read_stage");
    expect(estimateSpeakTokens(body)).toBeLessThanOrEqual(SPEAK_AMBIENT_MAX_TOKENS);
  });

  test("shrinks rather than disappearing on a crowded Stage, and stays valid JSON", () => {
    const body = stageAmbientContext(crowdedStage(), overview, ambientBudget - 80);

    expect(body.length).toBeLessThanOrEqual(ambientBudget - 80);

    const parsed = JSON.parse(body) as { visiblePieces: Array<{ id: string; title: string }> };

    expect(parsed.visiblePieces.length).toBeGreaterThan(0);
    expect(parsed.visiblePieces[0]!.title).toBe("Note 0");
  });

  test("names the current view and subagent status", () => {
    const parsed = JSON.parse(stageAmbientContext(stage(), overview, ambientBudget)) as {
      view: string;
      subagents: Array<{ name: string; status: string }>;
    };

    expect(parsed.view).toBe("All pieces");
    expect(parsed.subagents[0]).toMatchObject({ name: "Researcher", status: "done" });
  });
});

describe("read_stage", () => {
  test("returns real piece content by id or title", async () => {
    const result = await buildStageRead(
      { ownerId: OWNER, state: stage(), read: { pieces: [NOTE_ID, "flow", "Weeknight dal"] } },
      deps()
    );
    const pieces = result.pieces as Array<Record<string, unknown>>;

    expect(pieces.map((p) => p.title)).toEqual(["Onboarding plan", "Flow", "Weeknight dal"]);
    expect(pieces[0]!.text).toContain("ask for a name only after");
    expect(pieces[1]!.code).toContain("A[Talk] --> B[Answer]");
    expect(JSON.stringify(pieces[2]!.recipe)).toContain("1 cup red lentils");
  });

  test("reads a chat piece's latest messages with an ownership-checked read", async () => {
    let asked: { id: string; owner: string } | null = null;
    const result = await buildStageRead(
      { ownerId: OWNER, state: stage(), read: { pieces: [CHAT_ID] } },
      deps({
        getThreadScreen: async (id, options) => {
          asked = { id, owner: options.expectedOwnerId };

          return deps().getThreadScreen(id, options);
        },
      })
    );
    const chat = (result.pieces as Array<Record<string, unknown>>)[0]!;

    expect(asked!).toEqual({ id: THREAD_ID, owner: OWNER });
    expect(JSON.stringify(chat.latestMessages)).toContain("ask an open question");
  });

  test("a chat the owner cannot read stays unseen, and does not fail the read", async () => {
    const result = await buildStageRead(
      { ownerId: OWNER, state: stage(), read: { pieces: [CHAT_ID, NOTE_ID] } },
      deps({ getThreadScreen: async () => ({ data: null, error: "not-owner" }) })
    );
    const pieces = result.pieces as Array<Record<string, unknown>>;

    expect(pieces[0]).toMatchObject({ id: CHAT_ID, unavailable: true });
    expect(pieces[0]!.latestMessages).toBeUndefined();
    expect(pieces[1]!.text).toBeDefined();
  });

  test("includes subagent results and reports unknown references", async () => {
    const result = await buildStageRead(
      { ownerId: OWNER, state: stage(), read: { pieces: ["Nope"] } },
      deps()
    );

    expect(result.notFound).toEqual(["Nope"]);
    expect(JSON.stringify(result.subagents)).toContain("defer sign-up");
  });

  test("conversation is opt-in", async () => {
    const without = await buildStageRead(
      { ownerId: OWNER, state: stage(), read: { pieces: [NOTE_ID] } },
      deps()
    );
    const withConversation = await buildStageRead(
      { ownerId: OWNER, state: stage(), read: { pieces: [NOTE_ID], conversation: true } },
      deps()
    );

    expect(without.conversation).toBeUndefined();
    expect(JSON.stringify(withConversation.conversation)).toContain("plan for onboarding");
  });

  test("stays within its budget and says so when it trims", async () => {
    const state = crowdedStage();
    const result = await buildStageRead(
      {
        ownerId: OWNER,
        state,
        read: { pieces: state.widgets.slice(0, 8).map((w) => w.id), conversation: true },
      },
      deps()
    );

    expect(JSON.stringify(result).length).toBeLessThanOrEqual(STAGE_READ_MAX_CHARS + 32);
    expect(result.truncated).toBe(true);
  });

  test("with nothing recorded on screen, points the model at the piece list", async () => {
    const result = await buildStageRead(
      { ownerId: OWNER, state: stage({ presentation: undefined }), read: {} },
      deps()
    );

    expect(result.pieces).toEqual([]);
    expect(JSON.stringify(result.allPieces)).toContain("Onboarding plan");
  });
});

import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { StrataPageWithSections } from "@/lib/schemas/strata";
import type { AmbientContextDeps } from "@/lib/speak/ambient-context";

import { describe, expect, test } from "bun:test";

import { screenSurfaceKey } from "@/lib/schemas/speak-screen-context";
import {
  buildAmbientContext,
  buildChatSections,
  buildRabbitHoleSections,
  buildStrataSections,
  fitAmbientBody,
  SPEAK_AMBIENT_MAX_TOKENS,
} from "@/lib/speak/ambient-context";
import { AMBIENT_CLEARED_BODY, AMBIENT_PREFACE, buildAmbientContextItem } from "@/lib/speak/ambient-item";
import { estimateSpeakTokens } from "@/lib/speak/token-limit";

const OWNER = "owner-1";
const OTHER = "someone-else";

function strataPage(overrides?: Partial<Record<string, string>>): StrataPageWithSections {
  const section = (key: string, content: string) => ({ key, content, contentJson: null });

  return {
    page: {
      id: "page-1",
      title: "Field notes",
      owner_id: OWNER,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
    sections: {
      raw_text: section("raw_text", overrides?.raw ?? ""),
      refined_text: section("refined_text", overrides?.refined ?? ""),
      elaborated: section("elaborated", overrides?.elaborated ?? ""),
      design_instructions: section("design_instructions", "never included"),
      ai_instructions: section("ai_instructions", "never included"),
    },
  } as unknown as StrataPageWithSections;
}

function rabbitHole(): RabbitHoleSession {
  return {
    sessionId: "00000000-0000-4000-8000-000000000000",
    rootQuestion: "Why do cities hum?",
    rootNodeId: null,
    path: [],
    activeNodeId: "n2",
    edges: [{ from: "n1", to: "n2" }],
    nodesById: {
      n1: {
        id: "n1",
        rawPrompt: "",
        userQuestion: "Why do cities hum?",
        title: "City hum",
        summary: "Transformers and traffic dominate the low end.",
        keyTakeaways: [],
        createdAt: "2026-01-01",
      },
      n2: {
        id: "n2",
        rawPrompt: "",
        userQuestion: "What is mains hum?",
        title: "Mains hum",
        summary: "50/60Hz leakage from grid infrastructure.",
        keyTakeaways: [],
        createdAt: "2026-01-01",
      },
    },
    createdAt: "2026-01-01",
  } as unknown as RabbitHoleSession;
}

function deps(overrides: Partial<AmbientContextDeps> = {}): AmbientContextDeps {
  return {
    getThreadOwnerContext: async () => ({
      data: { threadId: "t1", ownerId: OWNER },
      error: null,
    }),
    getConversationSummary: async () => ({ data: "We compared two espresso grinders.", error: null }),
    getStrataPageById: async () => strataPage({ elaborated: "The compiled document." }),
    getSessionById: async () => ({ data: rabbitHole(), error: null }),
    getRabbitHoleSessionOwnerId: async () => OWNER,
    ...overrides,
  } as AmbientContextDeps;
}

describe("buildAmbientContextItem", () => {
  test("is a system message, which cannot open a response on its own", () => {
    const item = buildAmbientContextItem("The user opened a page.") as {
      type: string;
      item: { role: string; type: string; content: Array<{ type: string; text: string }> };
    };

    expect(item.type).toBe("conversation.item.create");
    expect(item.item.role).toBe("system");
    expect(item.item.type).toBe("message");
    expect(item.item.content[0]!.type).toBe("input_text");
  });

  test("never carries a response trigger", () => {
    const serialized = JSON.stringify(buildAmbientContextItem("anything"));

    expect(serialized).not.toContain("response.create");
  });

  test("tells the model in words not to act on it", () => {
    const item = buildAmbientContextItem("The user opened a page.") as {
      item: { content: Array<{ text: string }> };
    };

    expect(item.item.content[0]!.text).toContain(AMBIENT_PREFACE);
    expect(item.item.content[0]!.text).toContain("do not respond to it");
  });

  test("returns null for an empty body rather than pushing a no-op into history", () => {
    expect(buildAmbientContextItem("")).toBeNull();
    expect(buildAmbientContextItem("   \n ")).toBeNull();
  });
});

describe("fitAmbientBody", () => {
  test("drops trailing sections until it fits, keeping the lead", () => {
    const lead = "The user has a text chat open on screen.";
    const bulky = "word ".repeat(4_000);
    const text = fitAmbientBody([lead, bulky, bulky]);

    expect(text).toContain(lead);
    expect(estimateSpeakTokens(text)).toBeLessThanOrEqual(SPEAK_AMBIENT_MAX_TOKENS);
  });

  test("clips even a single oversized section", () => {
    const text = fitAmbientBody(["word ".repeat(10_000)]);

    expect(estimateSpeakTokens(text)).toBeLessThanOrEqual(SPEAK_AMBIENT_MAX_TOKENS * 1.1);
  });

  test("skips empty sections", () => {
    expect(fitAmbientBody(["a", "", "   ", "b"])).toBe("a\n\nb");
  });

  test("is far tighter than the resume preamble, since it is re-sent per navigation", () => {
    expect(SPEAK_AMBIENT_MAX_TOKENS).toBeLessThan(1_800);
  });
});

describe("buildStrataSections", () => {
  test("prefers the elaborated layer and names which one it used", () => {
    const text = buildStrataSections(
      strataPage({ raw: "raw", refined: "refined", elaborated: "elaborated body" })
    ).join("\n");

    expect(text).toContain("elaborated layer");
    expect(text).toContain("elaborated body");
  });

  test("falls back down the pipeline when later layers are empty", () => {
    expect(buildStrataSections(strataPage({ raw: "raw only" })).join("\n")).toContain("raw layer");
    expect(
      buildStrataSections(strataPage({ raw: "raw", refined: "refined only" })).join("\n")
    ).toContain("refined layer");
  });

  test("never leaks the authoring instruction sections", () => {
    const text = buildStrataSections(strataPage({ elaborated: "body" })).join("\n");

    expect(text).not.toContain("never included");
  });

  test("says so when the page is empty", () => {
    expect(buildStrataSections(strataPage()).join("\n")).toContain("still empty");
  });
});

describe("buildRabbitHoleSections", () => {
  test("names the active node and the root question", () => {
    const text = buildRabbitHoleSections(rabbitHole(), "n2").join("\n");

    expect(text).toContain("Why do cities hum?");
    expect(text).toContain("Mains hum");
  });

  test("renders the graph as readable parent-to-child lines", () => {
    expect(buildRabbitHoleSections(rabbitHole(), "n2").join("\n")).toContain(
      "City hum → Mains hum"
    );
  });

  test("includes a gist per node", () => {
    const text = buildRabbitHoleSections(rabbitHole(), "n2").join("\n");

    expect(text).toContain("50/60Hz leakage");
  });

  test("falls back to the plain header when no node is focused", () => {
    expect(buildRabbitHoleSections(rabbitHole(), null)[0]).toContain("has the rabbit hole");
  });
});

describe("buildChatSections", () => {
  test("carries the rolling summary", () => {
    expect(buildChatSections("We compared grinders.").join("\n")).toContain(
      "We compared grinders."
    );
  });

  test("is explicit when there is no summary yet", () => {
    expect(buildChatSections(null).join("\n")).toContain("no summary yet");
  });
});

describe("buildAmbientContext", () => {
  test("clears stale context when the user navigates somewhere unregistered", async () => {
    const body = await buildAmbientContext({ ownerId: OWNER, surface: { kind: "none" } }, deps());

    expect(body).toBe(AMBIENT_CLEARED_BODY);
  });

  test("returns nothing for a chat the caller does not own", async () => {
    const body = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "chat", id: "t1" } },
      deps({
        getThreadOwnerContext: async () => ({
          data: { threadId: "t1", ownerId: OTHER },
          error: null,
        }),
      } as Partial<AmbientContextDeps>)
    );

    expect(body).toBe("");
  });

  test("returns nothing for a Strata page the caller does not own", async () => {
    const foreign = strataPage({ elaborated: "secret" });

    foreign.page.owner_id = OTHER;

    const body = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "stratum", id: "page-1" } },
      deps({ getStrataPageById: async () => foreign } as Partial<AmbientContextDeps>)
    );

    expect(body).toBe("");
  });

  test("returns nothing for a rabbit hole the caller does not own", async () => {
    const body = await buildAmbientContext(
      {
        ownerId: OWNER,
        surface: { kind: "rabbit-hole", id: "00000000-0000-4000-8000-000000000000" },
      },
      deps({ getRabbitHoleSessionOwnerId: async () => OTHER } as Partial<AmbientContextDeps>)
    );

    expect(body).toBe("");
  });

  test("a data-layer failure yields no context rather than taking down the call", async () => {
    const body = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "stratum", id: "page-1" } },
      deps({
        getStrataPageById: async () => {
          throw new Error("supabase is down");
        },
      } as Partial<AmbientContextDeps>)
    );

    expect(body).toBe("");
  });

  test("stays within budget for a real surface", async () => {
    const body = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "stratum", id: "page-1" } },
      deps({
        getStrataPageById: async () => strataPage({ elaborated: "word ".repeat(5_000) }),
      } as Partial<AmbientContextDeps>)
    );

    expect(estimateSpeakTokens(body)).toBeLessThanOrEqual(SPEAK_AMBIENT_MAX_TOKENS * 1.1);
  });

  test("falls back to the session's own active node when the client did not send one", async () => {
    const body = await buildAmbientContext(
      {
        ownerId: OWNER,
        surface: { kind: "rabbit-hole", id: "00000000-0000-4000-8000-000000000000" },
      },
      deps()
    );

    expect(body).toContain("Mains hum");
  });
});

describe("screenSurfaceKey", () => {
  test("distinguishes surfaces of the same kind", () => {
    expect(screenSurfaceKey({ kind: "chat", id: "a" })).not.toBe(
      screenSurfaceKey({ kind: "chat", id: "b" })
    );
  });

  test("changes when the reader moves to a different rabbit-hole node", () => {
    const base = { kind: "rabbit-hole", id: "s1" } as const;

    expect(screenSurfaceKey({ ...base, activeNodeId: "n1" })).not.toBe(
      screenSurfaceKey({ ...base, activeNodeId: "n2" })
    );
  });

  test("is stable for the same surface, so navigating away and back costs nothing", () => {
    expect(screenSurfaceKey({ kind: "stratum", id: "p1" })).toBe(
      screenSurfaceKey({ kind: "stratum", id: "p1" })
    );
  });
});

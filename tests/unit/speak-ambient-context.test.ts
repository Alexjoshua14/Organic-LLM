import type { UIMessage } from "ai";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { StrataPageWithSections } from "@/lib/schemas/strata";
import type { AmbientContextDeps } from "@/lib/speak/ambient-context";

import { describe, expect, test } from "bun:test";

import { screenSurfaceKey } from "@/lib/schemas/speak-screen-context";
import {
  buildAmbientContext,
  buildChatSections,
  buildRecentMessagesSection,
  CHAT_RECENT_MAX_TOKENS,
  buildRabbitHoleSections,
  buildStrataSections,
  fitAmbientBody,
  SPEAK_AMBIENT_MAX_TOKENS,
} from "@/lib/speak/ambient-context";
import {
  AMBIENT_CLEARED_BODY,
  AMBIENT_LABEL,
  buildAmbientContextItem,
  buildAmbientDeleteEvent,
  isAmbientClientEvent,
} from "@/lib/speak/ambient-item";
import { estimateSpeakTokens } from "@/lib/speak/token-limit";
import {
  CHAT_THREAD_ID,
  chatMessage,
  chatThreadFixture,
  RABBIT_HOLE_SESSION_ID,
  rabbitHoleFixture,
  speakAmbientDeps,
} from "../helpers/speak-fixtures";

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

const rabbitHole = rabbitHoleFixture;

/**
 * A chain `c0 → c1 → … → c{depth-1}` with `sideBranches` leaves hanging off every chain node.
 * The open node is the deepest one, which insertion order puts last — the case a naive
 * first-N slice drops.
 */
function deepRabbitHole(
  depth: number,
  opts: { sideBranches?: number; labelChars?: number; summary?: string; question?: string } = {}
): RabbitHoleSession {
  const label = (id: string) =>
    opts.labelChars ? `${id} ${"x".repeat(opts.labelChars)}`.slice(0, opts.labelChars) : id;
  const path: RabbitHoleSession["path"] = [];
  const nodesById: RabbitHoleSession["nodesById"] = {};

  const add = (id: string, parentNodeId: string | null, summary: string) => {
    path.push({ nodeId: id, label: label(id), parentNodeId });
    nodesById[id] = {
      id,
      rawPrompt: "",
      userQuestion: opts.question ?? `Question for ${id}?`,
      title: label(id),
      summary,
      keyTakeaways: [],
      articleHtml: "<p>body</p>",
      createdAt: "2026-01-01",
    } as RabbitHoleSession["nodesById"][string];
  };

  for (let i = 0; i < depth; i++) {
    const id = `c${i}`;
    const last = i === depth - 1;

    add(id, i === 0 ? null : `c${i - 1}`, last ? (opts.summary ?? "OPEN NODE SUMMARY") : "other");

    for (let s = 0; s < (opts.sideBranches ?? 0); s++) add(`c${i}s${s}`, id, "side");
  }

  return {
    ...rabbitHole(),
    rootQuestion: opts.question ?? "Where does it go?",
    rootNodeId: "c0",
    path,
    nodesById,
    edges: [],
    activeNodeId: `c${depth - 1}`,
  } as RabbitHoleSession;
}

function deps(overrides: Partial<AmbientContextDeps> = {}): AmbientContextDeps {
  return speakAmbientDeps(
    {},
    { getStrataPageById: async () => strataPage({ elaborated: "The compiled document." }), ...overrides }
  );
}

/** Just the text the model would receive. */
async function bodyOf(...args: Parameters<typeof buildAmbientContext>): Promise<string> {
  return (await buildAmbientContext(...args)).body;
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

  test("opens with the [Screen] label the instructions refer to, then the body", () => {
    const item = buildAmbientContextItem("The user opened a page.") as {
      item: { content: Array<{ text: string }> };
    };

    expect(item.item.content[0]!.text).toBe(`${AMBIENT_LABEL}\nThe user opened a page.`);
  });

  test("carries no behavioural prohibitions — those live once in the instructions", () => {
    const text = JSON.stringify(buildAmbientContextItem("The user opened a page."));

    expect(text).not.toContain("do not respond");
    expect(text).not.toContain("do not acknowledge");
  });

  test("uses our item and event ids when given, so the next push can delete it", () => {
    const item = buildAmbientContextItem("body", { itemId: "ambient_item_1", eventId: "ambient_add_1" }) as {
      event_id: string;
      item: { id: string };
    };

    expect(item.item.id).toBe("ambient_item_1");
    expect(item.event_id).toBe("ambient_add_1");
  });

  test("returns null for an empty body rather than pushing a no-op into history", () => {
    expect(buildAmbientContextItem("")).toBeNull();
    expect(buildAmbientContextItem("   \n ")).toBeNull();
  });
});

describe("buildAmbientDeleteEvent", () => {
  test("deletes an item by id and tags the event as ours", () => {
    const event = buildAmbientDeleteEvent("ambient_item_1", "ambient_del_2");

    expect(event).toEqual({
      type: "conversation.item.delete",
      item_id: "ambient_item_1",
      event_id: "ambient_del_2",
    });
    expect(isAmbientClientEvent(event.event_id as string)).toBe(true);
  });

  test("errors from anything else are not mistaken for ours", () => {
    expect(isAmbientClientEvent("evt_123")).toBe(false);
    expect(isAmbientClientEvent(null)).toBe(false);
    expect(isAmbientClientEvent(undefined)).toBe(false);
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

  test("leads with the open node's summary, ahead of the graph", () => {
    const [header, active, graph] = buildRabbitHoleSections(rabbitHole(), "n2");

    expect(header).toContain('on the node "Mains hum"');
    expect(active).toContain("50/60Hz leakage");
    expect(active).toContain('the user asked: "What is mains hum?"');
    expect(graph).toContain("Map of the rabbit hole");
  });

  test("carries only the open node's summary, not every node's", () => {
    const text = buildRabbitHoleSections(rabbitHole(), "n2").join("\n");

    expect(text).not.toContain("Tyre noise");
    expect(text).not.toContain("Transformers and traffic");
  });

  test("renders the graph as an indented tree built from the path, marking the open node", () => {
    const graph = buildRabbitHoleSections(rabbitHole(), "n2")[2]!;

    expect(graph).toContain("- City hum\n  - Mains hum ← on screen\n  - Traffic rumble");
  });

  test("falls back to key takeaways, then the preview, when there is no stored summary", () => {
    const session = rabbitHole();

    session.nodesById.n2 = {
      ...session.nodesById.n2!,
      summary: null,
      keyTakeaways: ["Grid leaks at 60Hz", "Transformers buzz"],
    };
    expect(buildRabbitHoleSections(session, "n2")[1]).toContain(
      "Grid leaks at 60Hz; Transformers buzz"
    );

    session.nodesById.n2 = { ...session.nodesById.n2!, keyTakeaways: [], preview: "A quick take" };
    expect(buildRabbitHoleSections(session, "n2")[1]).toContain("A quick take");
  });

  test("says a node is still being written rather than passing its preview off as the article", () => {
    const session = rabbitHole();

    session.generatingNodeId = "n2";
    session.nodesById.n2 = {
      ...session.nodesById.n2!,
      summary: null,
      articleHtml: "",
      preview: "Early guess about hum",
    };

    const active = buildRabbitHoleSections(session, "n2")[1]!;

    expect(active).toContain("still being written");
    expect(active).toContain("Early guess about hum");
  });

  test("keeps the open node's summary when it sits deep in a large hole", () => {
    const text = fitAmbientBody(buildRabbitHoleSections(deepRabbitHole(40), "c39"));

    expect(text).toContain("OPEN NODE SUMMARY");
    expect(text).toContain("c39 ← on screen");
  });

  test("cuts the graph from the far end, keeping the open node's nearest ancestry", () => {
    const graph = buildRabbitHoleSections(deepRabbitHole(40), "c39")[2]!;

    expect(graph).toContain("c38");
    expect(graph).toContain("… › ");
    expect(graph).not.toMatch(/- c0\b/);
    expect(graph).toMatch(/\(…and \d+ more nodes not shown\)/);
  });

  test("fits the summary and the graph together in the worst case", () => {
    const session = deepRabbitHole(20, {
      sideBranches: 2,
      labelChars: 80,
      summary: `OPEN ${"dense summary ".repeat(800)}`,
      question: "q".repeat(500),
    });
    const text = fitAmbientBody(buildRabbitHoleSections(session, "c19"));

    expect(estimateSpeakTokens(text)).toBeLessThanOrEqual(SPEAK_AMBIENT_MAX_TOKENS);
    expect(text).toContain("OPEN dense summary");
    expect(text).toContain("Map of the rabbit hole");
    expect(text).toContain("← on screen");
  });

  test("skips the map for a single-node hole", () => {
    const session = deepRabbitHole(1);

    expect(buildRabbitHoleSections(session, "c0")[2]).toBe("");
  });

  test("falls back to the plain header when no node is focused, still mapping the hole", () => {
    const sections = buildRabbitHoleSections(rabbitHole(), null);

    expect(sections[0]).toContain("has the rabbit hole");
    expect(sections.join("\n")).toContain("- City hum");
    expect(sections.join("\n")).not.toContain("← on screen");
  });
});

describe("buildRecentMessagesSection", () => {
  const cap = CHAT_RECENT_MAX_TOKENS * 4;

  test("reads oldest first with speaker labels", () => {
    const text = buildRecentMessagesSection(chatThreadFixture().messages, cap);

    expect(text).toBe(
      "Latest messages, oldest first:\n" +
        "User: Should I get a flat or conical burr grinder?\n" +
        "Assistant: Flat burrs give a more uniform grind; conicals are quieter.\n" +
        "User: Which one for light roasts?\n" +
        "Assistant: Flat burrs — they bring out clarity in light roasts."
    );
  });

  test("keeps the newest messages when the cap bites, dropping the oldest whole", () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      chatMessage(`m${i}`, i % 2 ? "assistant" : "user", `message ${i} ${"x".repeat(250)}`)
    );
    const text = buildRecentMessagesSection(messages, 700);

    expect(text).toContain("message 5");
    expect(text).toContain("message 4");
    expect(text).not.toContain("message 0");
    expect(text.length).toBeLessThanOrEqual(700);
    // Whole messages or none: nothing half-quoted from the older end.
    expect(text.split("\n").slice(1).every((line) => /^(User|Assistant): message \d/.test(line))).toBe(true);
  });

  test("the newest message always survives, clipped if it alone overflows", () => {
    const text = buildRecentMessagesSection(
      [chatMessage("m1", "user", "older"), chatMessage("m2", "assistant", "y".repeat(5_000))],
      300
    );

    expect(text).toContain("Assistant: yyy");
    expect(text).not.toContain("older");
    expect(text.length).toBeLessThanOrEqual(300);
  });

  test("one long answer is clipped so it cannot crowd out the turn before it", () => {
    const text = buildRecentMessagesSection(
      [chatMessage("m1", "user", "What is a burr?"), chatMessage("m2", "assistant", "z".repeat(3_000))],
      cap
    );

    expect(text).toContain("User: What is a burr?");
    expect(text).toContain("…");
  });

  test("only what was said: tool calls, reasoning and empty messages are left out", () => {
    const withTools = {
      id: "m2",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "private chain of thought" },
        { type: "tool-render_gen_ui", toolCallId: "c1", state: "output-available", input: {}, output: {} },
        { type: "text", text: "Here is a comparison." },
      ],
    } as unknown as UIMessage;
    const text = buildRecentMessagesSection(
      [chatMessage("m1", "user", "Compare them"), withTools, chatMessage("m3", "user", "   ")],
      cap
    );

    expect(text).toContain("Assistant: Here is a comparison.");
    expect(text).not.toContain("chain of thought");
    expect(text).not.toContain("render_gen_ui");
    expect(text.split("\n")).toHaveLength(3);
  });
});

describe("buildChatSections", () => {
  test("title, then the latest messages, then the summary", () => {
    const [header, recent, summary] = buildChatSections(chatThreadFixture());

    expect(header).toBe('The user has the chat "Espresso grinders" open.');
    expect(recent).toContain("Assistant: Flat burrs — they bring out clarity in light roasts.");
    expect(summary).toBe(
      "What the conversation has covered so far:\nComparing flat and conical burr grinders for home espresso."
    );
  });

  test("an untitled chat says so", () => {
    expect(buildChatSections({ ...chatThreadFixture(), title: null })[0]).toBe(
      "The user has an untitled chat open."
    );
  });

  test("a chat with nothing in it yet says so", () => {
    expect(buildChatSections({ title: "New chat", messages: [], summary: null })).toEqual([
      'The user has the chat "New chat" open.',
      "It has no messages yet.",
    ]);
  });

  test("messages without a summary yet still describe the chat", () => {
    const sections = buildChatSections({ ...chatThreadFixture(), summary: null });

    expect(sections).toHaveLength(2);
    expect(sections[1]).toContain("Which one for light roasts?");
  });

  test("recent messages hold to their own cap, well inside the budget", () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      chatMessage(`m${i}`, i % 2 ? "assistant" : "user", "w".repeat(2_000))
    );
    const recent = buildChatSections({ title: "Long", messages, summary: null })[1]!;

    expect(estimateSpeakTokens(recent)).toBeLessThanOrEqual(CHAT_RECENT_MAX_TOKENS);
  });

  test("worst case — long title, long messages, huge summary — keeps all three within budget", () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      chatMessage(`m${i}`, i % 2 ? "assistant" : "user", "w".repeat(2_000))
    );
    const text = fitAmbientBody(
      buildChatSections({ title: "t".repeat(400), messages, summary: `SUMMARY ${"s".repeat(20_000)}` })
    );

    expect(estimateSpeakTokens(text)).toBeLessThanOrEqual(SPEAK_AMBIENT_MAX_TOKENS);
    expect(text).toContain("The user has the chat");
    expect(text).toContain("Latest messages, oldest first:");
    expect(text).toContain("What the conversation has covered so far:\nSUMMARY");
  });
});

describe("buildAmbientContext", () => {
  test("clears stale context when the user navigates somewhere unregistered", async () => {
    const context = await buildAmbientContext({ ownerId: OWNER, surface: { kind: "none" } }, deps());

    expect(context.body).toBe(AMBIENT_CLEARED_BODY);
    expect(context.reason).toBeUndefined();
  });

  test("opening a chat gives its title, latest messages and summary, labelled for the chip", async () => {
    const context = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "chat", id: CHAT_THREAD_ID } },
      deps()
    );

    expect(context.label).toBe("Chat · Espresso grinders");
    expect(context.body).toContain('The user has the chat "Espresso grinders" open.');
    expect(context.body).toContain("User: Which one for light roasts?");
    expect(context.body).toContain("Comparing flat and conical burr grinders for home espresso.");
  });

  test("asks the data layer for only a handful of recent messages", async () => {
    let requested: number | undefined;

    await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "chat", id: CHAT_THREAD_ID } },
      deps({
        getNMessages: async (_id: string, limit?: number) => {
          requested = limit;

          return { data: [], error: null };
        },
      } as Partial<AmbientContextDeps>)
    );

    expect(requested).toBeGreaterThan(0);
    expect(requested).toBeLessThanOrEqual(10);
  });

  test("returns nothing for a chat the caller does not own, and says why", async () => {
    const context = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "chat", id: CHAT_THREAD_ID } },
      deps({
        getThreadOwnerContext: async () => ({
          data: { threadId: CHAT_THREAD_ID, ownerId: OTHER },
          error: null,
        }),
      } as Partial<AmbientContextDeps>)
    );

    expect(context).toEqual({ body: "", label: "Chat", reason: "not-owner" });
  });

  test("a chat that does not exist is not-found, not an error", async () => {
    const context = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "chat", id: CHAT_THREAD_ID } },
      deps({
        getThreadOwnerContext: async () => ({ data: null, error: new Error("Thread not found") }),
      } as Partial<AmbientContextDeps>)
    );

    expect(context.reason).toBe("not-found");
  });

  test("returns nothing for a Strata page the caller does not own", async () => {
    const foreign = strataPage({ elaborated: "secret" });

    foreign.page.owner_id = OTHER;

    const context = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "stratum", id: "page-1" } },
      deps({ getStrataPageById: async () => foreign } as Partial<AmbientContextDeps>)
    );

    expect(context).toEqual({ body: "", label: "Strata", reason: "not-owner" });
  });

  test("returns nothing for a rabbit hole the caller does not own", async () => {
    const context = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "rabbit-hole", id: RABBIT_HOLE_SESSION_ID } },
      deps({ getRabbitHoleSessionOwnerId: async () => OTHER } as Partial<AmbientContextDeps>)
    );

    expect(context).toEqual({ body: "", label: "Rabbit hole", reason: "not-owner" });
  });

  test("a data-layer failure yields no context rather than taking down the call", async () => {
    const context = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "stratum", id: "page-1" } },
      deps({
        getStrataPageById: async () => {
          throw new Error("supabase is down");
        },
      } as Partial<AmbientContextDeps>)
    );

    expect(context).toEqual({ body: "", label: "Strata", reason: "error" });
  });

  test("stays within budget for a real surface", async () => {
    const body = await bodyOf(
      { ownerId: OWNER, surface: { kind: "stratum", id: "page-1" } },
      deps({
        getStrataPageById: async () => strataPage({ elaborated: "word ".repeat(5_000) }),
      } as Partial<AmbientContextDeps>)
    );

    expect(estimateSpeakTokens(body)).toBeLessThanOrEqual(SPEAK_AMBIENT_MAX_TOKENS * 1.1);
  });

  test("labels the rabbit hole by its open node, and falls back to the session's own", async () => {
    const context = await buildAmbientContext(
      { ownerId: OWNER, surface: { kind: "rabbit-hole", id: RABBIT_HOLE_SESSION_ID } },
      deps()
    );

    expect(context.body).toContain("Mains hum");
    expect(context.label).toBe("Rabbit hole · Mains hum");
  });
});

describe("buildAmbientContext for a rabbit hole", () => {
  const surface = (activeNodeId: string) =>
    ({ kind: "rabbit-hole", id: RABBIT_HOLE_SESSION_ID, activeNodeId }) as const;

  test("opening one gives the open node's summary and the whole map", async () => {
    const body = await bodyOf({ ownerId: OWNER, surface: surface("n2") }, deps());

    expect(body).toContain('The user is reading the rabbit hole "Why do cities hum?"');
    expect(body).toContain('What "Mains hum" (the user asked: "What is mains hum?") covers:');
    expect(body).toContain("50/60Hz leakage from grid infrastructure.");
    expect(body).toContain(
      "Map of the rabbit hole (indented = branched from the node above):\n" +
        "- City hum\n" +
        "  - Mains hum ← on screen\n" +
        "  - Traffic rumble"
    );
  });

  test("moving to another node follows the reader: new summary, marker moved", async () => {
    const before = await bodyOf({ ownerId: OWNER, surface: surface("n2") }, deps());
    const after = await bodyOf({ ownerId: OWNER, surface: surface("n3") }, deps());

    expect(after).toContain('on the node "Traffic rumble"');
    expect(after).toContain("Tyre noise carries further once the air cools.");
    expect(after).toContain("  - Traffic rumble ← on screen");
    expect(after).not.toContain("50/60Hz leakage");
    expect(after).not.toContain("Mains hum ← on screen");
    expect(after).not.toBe(before);
  });

  test("the client's node wins over the one saved on the session", async () => {
    // The saved session says n2; the reader has already moved to n3 and the save has not landed.
    const body = await bodyOf({ ownerId: OWNER, surface: surface("n3") }, deps());

    expect(body).toContain("Traffic rumble ← on screen");
  });

  test("a branch still generating says so, then carries its summary once the article lands", async () => {
    let session = rabbitHole();

    session.generatingNodeId = "n3";
    session.nodesById.n3 = {
      ...session.nodesById.n3!,
      summary: null,
      articleHtml: "",
      preview: "Early guess about traffic",
    };

    const live = deps({
      getSessionById: async () => ({ data: session, error: null }),
    } as Partial<AmbientContextDeps>);
    const pending = await bodyOf({ ownerId: OWNER, surface: surface("n3") }, live);

    expect(pending).toContain("still being written");
    expect(pending).toContain("Early guess about traffic");

    session = rabbitHole();

    const landed = await bodyOf({ ownerId: OWNER, surface: surface("n3") }, live);

    expect(landed).not.toContain("still being written");
    expect(landed).toContain("Tyre noise carries further once the air cools.");
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

  test("changes when the open node's article lands, so its summary is re-pushed", () => {
    const base = { kind: "rabbit-hole", id: "s1", activeNodeId: "n1" } as const;

    expect(screenSurfaceKey({ ...base, activeNodePending: true })).not.toBe(
      screenSurfaceKey({ ...base, activeNodePending: false })
    );
    expect(screenSurfaceKey({ ...base, activeNodePending: false })).toBe(screenSurfaceKey(base));
  });

  test("is stable for the same surface, so navigating away and back costs nothing", () => {
    expect(screenSurfaceKey({ kind: "stratum", id: "p1" })).toBe(
      screenSurfaceKey({ kind: "stratum", id: "p1" })
    );
  });
});

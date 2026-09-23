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
import { RABBIT_HOLE_SESSION_ID, rabbitHoleFixture } from "../helpers/speak-fixtures";

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

describe("buildAmbientContext for a rabbit hole", () => {
  const surface = (activeNodeId: string) =>
    ({ kind: "rabbit-hole", id: RABBIT_HOLE_SESSION_ID, activeNodeId }) as const;

  test("opening one gives the open node's summary and the whole map", async () => {
    const body = await buildAmbientContext({ ownerId: OWNER, surface: surface("n2") }, deps());

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
    const before = await buildAmbientContext({ ownerId: OWNER, surface: surface("n2") }, deps());
    const after = await buildAmbientContext({ ownerId: OWNER, surface: surface("n3") }, deps());

    expect(after).toContain('on the node "Traffic rumble"');
    expect(after).toContain("Tyre noise carries further once the air cools.");
    expect(after).toContain("  - Traffic rumble ← on screen");
    expect(after).not.toContain("50/60Hz leakage");
    expect(after).not.toContain("Mains hum ← on screen");
    expect(after).not.toBe(before);
  });

  test("the client's node wins over the one saved on the session", async () => {
    // The saved session says n2; the reader has already moved to n3 and the save has not landed.
    const body = await buildAmbientContext({ ownerId: OWNER, surface: surface("n3") }, deps());

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
    const pending = await buildAmbientContext({ ownerId: OWNER, surface: surface("n3") }, live);

    expect(pending).toContain("still being written");
    expect(pending).toContain("Early guess about traffic");

    session = rabbitHole();

    const landed = await buildAmbientContext({ ownerId: OWNER, surface: surface("n3") }, live);

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

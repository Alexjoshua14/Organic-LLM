import { describe, expect, test } from "bun:test";

import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";
import type { RabbitHoleToolsetDeps } from "@/lib/llm/rabbit-hole-toolset/deps";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { gateResponseSize } from "@/lib/llm/rabbit-hole-toolset/access";
import { createRabbitHoleCreateTools } from "@/lib/llm/rabbit-hole-toolset/create-tools";
import { rabbitHoleToolsetInstructions } from "@/lib/llm/rabbit-hole-toolset/instructions";
import { createRabbitHoleReadTools } from "@/lib/llm/rabbit-hole-toolset/read-tools";
import { searchRabbitHoles, tokenizeSearchQuery } from "@/lib/llm/rabbit-hole-toolset/search";
import {
  articleHtmlToText,
  buildGraphEntries,
  estimateTokens,
  parseArticleSections,
  shapeRabbitHoleNode,
  shapeRabbitHoleSession,
} from "@/lib/llm/rabbit-hole-toolset/shape";

const USER = "user-1";
const OTHER_USER = "user-2";
const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_SESSION_ID = "550e8400-e29b-41d4-a716-446655440999";
const ROOT = "root";
const CHILD = "child";
const NOW = "2026-10-27T12:00:00.000Z";

const ARTICLE = `<section><p>Lead paragraph.</p><h2 id="takeaway-0">Lists &amp; deques</h2><p>append is O(1).</p><h2 id="takeaway-1">Heaps</h2><p>heappush is O(log n).</p></section>`;

function makeSession(overrides: Partial<RabbitHoleSession> = {}): RabbitHoleSession {
  return {
    sessionId: SESSION_ID,
    rootQuestion: "Python data structures",
    rootNodeId: ROOT,
    activeNodeId: ROOT,
    generatingNodeId: null,
    path: [
      { nodeId: ROOT, label: "Python data structures", parentNodeId: null },
      { nodeId: CHILD, label: "Heaps in depth", parentNodeId: ROOT },
    ],
    edges: [{ from: ROOT, to: CHILD }],
    nodesById: {
      [ROOT]: {
        id: ROOT,
        title: "Python data structures",
        rawPrompt: "p",
        userQuestion: "Python data structures",
        summary: "Complexity of core Python containers.",
        keyTakeaways: ["lists", "dicts", "heaps"],
        articleHtml: ARTICLE,
        sources: [{ status: "none", id: "s1", title: "CPython docs", url: "https://docs.python.org/" }],
        branchSuggestions: [{ id: "b1", label: "heapq internals", shortDescription: "How heapq works" }],
        createdAt: NOW,
      },
      [CHILD]: {
        id: CHILD,
        title: "Heaps in depth",
        rawPrompt: "p",
        userQuestion: "How do heaps work?",
        keyTakeaways: ["push", "pop", "heapify"],
        articleHtml: "<p>Heaps.</p>",
        createdAt: NOW,
      },
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const metadata: RabbitHoleSessionMetadata[] = [
  {
    sessionId: SESSION_ID,
    rootQuestion: "Python data structures",
    rootTitle: "Python data structures",
    createdAt: NOW,
    updatedAt: NOW,
    pathLength: 2,
    summary: "lists • dicts",
  },
  {
    sessionId: OTHER_SESSION_ID,
    rootQuestion: "Sourdough baking",
    rootTitle: "Sourdough baking",
    createdAt: NOW,
    updatedAt: NOW,
    pathLength: 1,
  },
];

type FakeOptions = {
  session?: RabbitHoleSession;
  ownerId?: string | null;
  spend?: { ok: true } | { ok: false; error: string };
};

function makeDeps(options: FakeOptions = {}) {
  const session = options.session ?? makeSession();
  const scheduled: Array<{ sessionId: string; nodeId: string; serializedSession: string }> = [];
  let idCounter = 0;
  const deps: RabbitHoleToolsetDeps = {
    listSessions: async () => ({ data: metadata, error: null }),
    getNodeSearchRows: async () => ({
      data: [
        {
          sessionId: SESSION_ID,
          nodeId: CHILD,
          title: "Heaps in depth",
          userQuestion: "How do heaps work?",
          keyTakeaways: ["push", "pop", "heapify"],
          summary: null,
        },
      ],
      error: null,
    }),
    getSession: async (id) => ({ data: id === session.sessionId ? session : null, error: null }),
    getSessionOwnerId: async (id) =>
      id === session.sessionId ? (options.ownerId === undefined ? USER : options.ownerId) : null,
    checkSpend: async () => options.spend ?? { ok: true },
    scheduleGeneration: async (params) => {
      scheduled.push(params);

      return { jobId: "job" };
    },
    newId: () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`,
    now: () => NOW,
  };

  return { deps, scheduled };
}

/** A unique `messages` array per call stands in for one assistant turn. */
function turn() {
  return { toolCallId: "call", messages: [{ role: "user", content: "hi" }] } as never;
}

async function run<T extends { execute?: unknown }>(t: T, input: unknown, options = turn()) {
  return (t.execute as (i: unknown, o: unknown) => Promise<Record<string, unknown>>)(input, options);
}

describe("article parsing", () => {
  test("splits at h2 headings, keeps DOM ids, and puts leading text in an introduction", () => {
    const sections = parseArticleSections(ARTICLE);

    expect(sections.map((s) => [s.index, s.id, s.heading])).toEqual([
      [0, null, "Introduction"],
      [1, "takeaway-0", "Lists & deques"],
      [2, "takeaway-1", "Heaps"],
    ]);
  });

  test("treats an article with no h2 as one section, and no article as none", () => {
    expect(parseArticleSections("<p>Just text</p>", "Fallback")).toHaveLength(1);
    expect(parseArticleSections("<p>Just text</p>", "Fallback")[0]?.heading).toBe("Fallback");
    expect(parseArticleSections(null)).toEqual([]);
    expect(parseArticleSections("   ")).toEqual([]);
  });

  test("converts HTML to text without decoding escaped markup into tags", () => {
    const text = articleHtmlToText("<h2>Title</h2><p>a &lt;b&gt; &amp; c</p><ul><li>one</li></ul>");

    expect(text).toContain("## Title");
    expect(text).toContain("a <b> & c");
    expect(text).toContain("- one");
  });
});

describe("session and node shaping", () => {
  test("builds the graph from path segments with parents", () => {
    expect(buildGraphEntries(makeSession())).toEqual([
      { nodeId: ROOT, title: "Python data structures", parentNodeId: null },
      { nodeId: CHILD, title: "Heaps in depth", parentNodeId: ROOT },
    ]);
  });

  test("high_level carries structure only; overview adds takeaways; detailed adds content", () => {
    const high = shapeRabbitHoleSession(makeSession(), "high_level");
    const overview = shapeRabbitHoleSession(makeSession(), "overview");
    const detailed = shapeRabbitHoleSession(makeSession(), "detailed");

    expect(high.nodeCount).toBe(2);
    expect(high.description).toBe("Complexity of core Python containers.");
    expect(JSON.stringify(high)).not.toContain("takeaways");
    expect(JSON.stringify(overview)).toContain("heapify");
    expect(JSON.stringify(overview)).not.toContain("heappush");
    expect(JSON.stringify(detailed)).toContain("heappush is O(log n).");
  });

  test("a node's high_level read lists its sections and relatives", () => {
    const session = makeSession();
    const node = shapeRabbitHoleNode(session, session.nodesById[ROOT]!, "high_level");

    expect(node.childNodeIds).toEqual([CHILD]);
    expect(node.sections.map((s) => s.heading)).toEqual(["Introduction", "Lists & deques", "Heaps"]);
    expect(node.status).toBe("ready");
  });

  test("marks the generating node and an article-less node", () => {
    const session = makeSession({ generatingNodeId: CHILD });

    session.nodesById[CHILD]!.articleHtml = null;

    expect(shapeRabbitHoleNode(session, session.nodesById[CHILD]!, "high_level").status).toBe(
      "generating"
    );
  });
});

describe("keyword search", () => {
  test("drops stopwords and duplicates", () => {
    expect(tokenizeSearchQuery("The Python and python heapq")).toEqual(["python", "heapq"]);
  });

  test("ranks sessions by distinct terms and reports matching nodes", async () => {
    const { deps } = makeDeps();
    const sessions = (await deps.listSessions()).data!;
    const nodeRows = (await deps.getNodeSearchRows([]))!.data!;
    const hits = searchRabbitHoles({ query: "python heaps", sessions, nodeRows, limit: 5 });

    expect(hits.map((h) => h.sessionId)).toEqual([SESSION_ID]);
    expect(hits[0]?.matchingNodes[0]?.nodeId).toBe(CHILD);
    expect(hits[0]?.matchedTerms.sort()).toEqual(["heaps", "python"]);
  });

  test("returns nothing for a query of only stopwords", () => {
    expect(searchRabbitHoles({ query: "the of", sessions: metadata, nodeRows: [], limit: 5 })).toEqual(
      []
    );
  });
});

describe("response size gate", () => {
  test("passes small payloads and refuses ones over the cap with guidance", () => {
    expect(gateResponseSize({ a: "x" }, 10).ok).toBe(true);

    const refused = gateResponseSize({ a: "x".repeat(400) }, 10);

    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.estimatedTokens).toBe(estimateTokens(JSON.stringify({ a: "x".repeat(400) })));
      expect(refused.error).toContain("overview");
    }
  });
});

describe("read tools", () => {
  test("list and search return the user's sessions with urls", async () => {
    const { deps } = makeDeps();
    const tools = createRabbitHoleReadTools({ sbUserId: USER, deps });
    const listed = await run(tools.list_rabbit_holes, { limit: 30 });
    const searched = await run(tools.search_rabbit_holes, { query: "python", limit: 8 });

    expect(listed.ok).toBe(true);
    expect((listed.sessions as unknown[]).length).toBe(2);
    expect(JSON.stringify(listed)).toContain(`/rabbitholes?sessionId=${SESSION_ID}`);
    expect(searched.resultCount).toBe(1);
  });

  test("get_rabbit_hole honors the detail level", async () => {
    const { deps } = makeDeps();
    const tools = createRabbitHoleReadTools({ sbUserId: USER, deps });
    const high = await run(tools.get_rabbit_hole, { sessionId: SESSION_ID, detail: "high_level" });
    const detailed = await run(tools.get_rabbit_hole, { sessionId: SESSION_ID, detail: "detailed" });

    expect(JSON.stringify(high)).not.toContain("heappush");
    expect(JSON.stringify(detailed)).toContain("heappush");
  });

  test("refuses another user's session with the same message as a missing one", async () => {
    const { deps } = makeDeps({ ownerId: OTHER_USER });
    const tools = createRabbitHoleReadTools({ sbUserId: USER, deps });
    const foreign = await run(tools.get_rabbit_hole, { sessionId: SESSION_ID, detail: "detailed" });
    const missing = await run(tools.get_rabbit_hole, {
      sessionId: OTHER_SESSION_ID,
      detail: "detailed",
    });

    expect(foreign).toEqual({ ok: false, error: "Rabbit hole not found." });
    expect(missing).toEqual(foreign);
  });

  test("get_rabbit_hole_node_section returns one section by index or id", async () => {
    const { deps } = makeDeps();
    const tools = createRabbitHoleReadTools({ sbUserId: USER, deps });
    const byIndex = await run(tools.get_rabbit_hole_node_section, {
      sessionId: SESSION_ID,
      nodeId: ROOT,
      sectionIndex: 2,
    });
    const byId = await run(tools.get_rabbit_hole_node_section, {
      sessionId: SESSION_ID,
      nodeId: ROOT,
      sectionId: "takeaway-0",
    });

    expect(JSON.stringify(byIndex)).toContain("heappush is O(log n).");
    expect(JSON.stringify(byIndex)).not.toContain("append is O(1)");
    expect(JSON.stringify(byId)).toContain("append is O(1).");
  });

  test("get_rabbit_hole_node_section explains bad input", async () => {
    const { deps } = makeDeps();
    const tools = createRabbitHoleReadTools({ sbUserId: USER, deps });

    expect(
      (await run(tools.get_rabbit_hole_node_section, { sessionId: SESSION_ID, nodeId: ROOT })).error
    ).toContain("sectionIndex");
    expect(
      (
        await run(tools.get_rabbit_hole_node_section, {
          sessionId: SESSION_ID,
          nodeId: ROOT,
          sectionIndex: 9,
        })
      ).error
    ).toContain("0–2");
    expect(
      (await run(tools.get_rabbit_hole_node, { sessionId: SESSION_ID, nodeId: "nope", detail: "high_level" }))
        .error
    ).toContain("Node not found");
  });

  test("a detailed read over the token cap is refused, not returned", async () => {
    const session = makeSession();

    session.nodesById[ROOT]!.articleHtml = `<p>${"word ".repeat(140_000)}</p>`;

    const { deps } = makeDeps({ session });
    const tools = createRabbitHoleReadTools({ sbUserId: USER, deps });
    const refused = await run(tools.get_rabbit_hole, { sessionId: SESSION_ID, detail: "detailed" });
    const overview = await run(tools.get_rabbit_hole, { sessionId: SESSION_ID, detail: "overview" });

    expect(refused.ok).toBe(false);
    expect(refused.capTokens).toBe(150_000);
    expect(overview.ok).toBe(true);
  });
});

describe("create tools", () => {
  test("create_rabbit_hole schedules a new session with one generating root node", async () => {
    const { deps, scheduled } = makeDeps();
    const tools = createRabbitHoleCreateTools({ sbUserId: USER, deps });
    const result = await run(tools.create_rabbit_hole, {
      query: "Advanced Python for interviews: heapq, hashmaps",
      title: "Advanced Python for interviews",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("generating");
    expect(scheduled).toHaveLength(1);

    const session = JSON.parse(scheduled[0]!.serializedSession) as RabbitHoleSession;

    expect(session.sessionId).toBe(result.sessionId as string);
    expect(session.rootNodeId).toBe(result.nodeId as string);
    expect(session.generatingNodeId).toBe(result.nodeId as string);
    expect(Object.keys(session.nodesById)).toEqual([result.nodeId as string]);
    expect(result.url).toBe(`/rabbitholes?sessionId=${session.sessionId}`);
  });

  test("create_rabbit_hole_node attaches under the given parent", async () => {
    const { deps, scheduled } = makeDeps();
    const tools = createRabbitHoleCreateTools({ sbUserId: USER, deps });
    const result = await run(tools.create_rabbit_hole_node, {
      sessionId: SESSION_ID,
      query: "Heaps vs sorted lists",
      parentNodeId: CHILD,
    });

    expect(result.ok).toBe(true);
    expect(result.parentNodeId).toBe(CHILD);

    const saved = JSON.parse(scheduled[0]!.serializedSession) as RabbitHoleSession;
    const added = saved.path.find((p) => p.nodeId === result.nodeId);

    expect(added?.parentNodeId).toBe(CHILD);
    expect(Object.keys(saved.nodesById)).toHaveLength(3);
  });

  test("with no parent it attaches under the root; the drawer's default parent wins when set", async () => {
    const root = makeDeps();
    const rootTools = createRabbitHoleCreateTools({ sbUserId: USER, deps: root.deps });
    const rootResult = await run(rootTools.create_rabbit_hole_node, {
      sessionId: SESSION_ID,
      query: "Tries",
    });

    expect(rootResult.parentNodeId).toBe(ROOT);

    const drawer = makeDeps();
    const drawerTools = createRabbitHoleCreateTools({
      sbUserId: USER,
      deps: drawer.deps,
      currentSessionId: SESSION_ID,
      getDefaultParentNodeId: () => CHILD,
    });
    const drawerResult = await run(drawerTools.create_rabbit_hole_node, {
      sessionId: SESSION_ID,
      query: "Tries",
    });

    expect(drawerResult.parentNodeId).toBe(CHILD);
  });

  test("an unknown parent is rejected with the valid choices, and nothing is scheduled", async () => {
    const { deps, scheduled } = makeDeps();
    const tools = createRabbitHoleCreateTools({ sbUserId: USER, deps });
    const result = await run(tools.create_rabbit_hole_node, {
      sessionId: SESSION_ID,
      query: "Tries",
      parentNodeId: "made-up",
    });

    expect(result.ok).toBe(false);
    expect((result.validParents as Array<{ nodeId: string }>).map((p) => p.nodeId)).toEqual([
      ROOT,
      CHILD,
    ]);
    expect(scheduled).toHaveLength(0);
  });

  test("refuses another user's session and a failed spend gate, scheduling nothing", async () => {
    const foreign = makeDeps({ ownerId: OTHER_USER });
    const foreignTools = createRabbitHoleCreateTools({ sbUserId: USER, deps: foreign.deps });

    expect(
      (await run(foreignTools.create_rabbit_hole_node, { sessionId: SESSION_ID, query: "x" })).error
    ).toBe("Rabbit hole not found.");
    expect(foreign.scheduled).toHaveLength(0);

    const capped = makeDeps({ spend: { ok: false, error: "Rabbit Hole node limit exceeded" } });
    const cappedTools = createRabbitHoleCreateTools({ sbUserId: USER, deps: capped.deps });

    expect((await run(cappedTools.create_rabbit_hole, { query: "x" })).error).toBe(
      "Rabbit Hole node limit exceeded"
    );
    expect(
      (await run(cappedTools.create_rabbit_hole_node, { sessionId: SESSION_ID, query: "x" })).error
    ).toBe("Rabbit Hole node limit exceeded");
    expect(capped.scheduled).toHaveLength(0);
  });

  test("allows one creation per request across both tools, and a failed attempt does not use it up", async () => {
    const { deps, scheduled } = makeDeps();
    // One factory call is one chat request: every step of the turn shares it.
    const tools = createRabbitHoleCreateTools({ sbUserId: USER, deps });

    const bad = await run(tools.create_rabbit_hole_node, {
      sessionId: SESSION_ID,
      query: "x",
      parentNodeId: "made-up",
    });
    const first = await run(tools.create_rabbit_hole, { query: "one" });
    const secondOfSameKind = await run(tools.create_rabbit_hole, { query: "two" }, turn());
    const secondOfOtherKind = await run(
      tools.create_rabbit_hole_node,
      { sessionId: SESSION_ID, query: "three" },
      turn()
    );

    expect(bad.ok).toBe(false);
    expect(first.ok).toBe(true);
    expect(secondOfSameKind.error).toContain("Only one");
    expect(secondOfOtherKind.error).toContain("Only one");
    expect(scheduled).toHaveLength(1);

    const nextRequest = createRabbitHoleCreateTools({ sbUserId: USER, deps });

    expect((await run(nextRequest.create_rabbit_hole, { query: "four" })).ok).toBe(true);
  });

  test("parallel calls in one step cannot both create", async () => {
    const { deps, scheduled } = makeDeps();
    const tools = createRabbitHoleCreateTools({ sbUserId: USER, deps });
    const results = await Promise.all([
      run(tools.create_rabbit_hole, { query: "a" }),
      run(tools.create_rabbit_hole, { query: "b" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(scheduled).toHaveLength(1);
  });

  test("waits out a node that is still generating, but ignores a stale flag", async () => {
    const generating = makeSession({ generatingNodeId: CHILD });

    generating.nodesById[CHILD]!.articleHtml = null;

    const busy = makeDeps({ session: generating });
    const busyTools = createRabbitHoleCreateTools({ sbUserId: USER, deps: busy.deps });

    expect(
      (await run(busyTools.create_rabbit_hole_node, { sessionId: SESSION_ID, query: "x" })).error
    ).toContain("still generating");

    const stale = makeSession({ generatingNodeId: CHILD, updatedAt: "2026-10-27T11:00:00.000Z" });

    stale.nodesById[CHILD]!.articleHtml = null;

    const abandoned = makeDeps({ session: stale });
    const abandonedTools = createRabbitHoleCreateTools({ sbUserId: USER, deps: abandoned.deps });

    expect(
      (await run(abandonedTools.create_rabbit_hole_node, { sessionId: SESSION_ID, query: "x" })).ok
    ).toBe(true);
  });

  test("only the drawer's own session pulls the viewport to the new node", async () => {
    const written: unknown[] = [];
    const writer = { write: (part: unknown) => void written.push(part) };
    const { deps } = makeDeps();
    const inSession = createRabbitHoleCreateTools({
      sbUserId: USER,
      deps,
      writer: writer as never,
      currentSessionId: SESSION_ID,
    });
    const elsewhere = createRabbitHoleCreateTools({
      sbUserId: USER,
      deps,
      writer: writer as never,
      currentSessionId: OTHER_SESSION_ID,
    });

    await run(elsewhere.create_rabbit_hole_node, { sessionId: SESSION_ID, query: "x" });
    expect(written).toHaveLength(0);

    await run(inSession.create_rabbit_hole_node, { sessionId: SESSION_ID, query: "x" });
    expect(written).toHaveLength(1);
  });
});

describe("instructions", () => {
  test("each category brings its own guidance, and creation puts approval on the agent", () => {
    const read = rabbitHoleToolsetInstructions(["read"]);
    const create = rabbitHoleToolsetInstructions(["create"]);

    expect(read).toContain("get_rabbit_hole_node_section");
    expect(read).not.toContain("create_rabbit_hole");
    expect(create).toContain("do not ask the user for approval — you do");
    expect(create).toContain("search_rabbit_holes");
    expect(rabbitHoleToolsetInstructions(["read", "create"])).toContain(read);
  });
});

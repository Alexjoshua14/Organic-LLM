import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

import {
  OrganicToolCallPresence,
  RABBIT_HOLE_OPEN_NODE_EVENT,
} from "@/components/chat/organic-tool-call-presence";
import {
  RabbitHoleToolPresence,
  isRabbitHoleToolName,
} from "@/components/chat/rabbit-hole-tool-presence";

const output = {
  ok: true,
  sessionId: "session-123",
  nodeId: "node-123",
  title: "The geometry of a black hole",
  status: "generating",
  url: "javascript:alert(1)",
};

const noop = () => {};

type Feed = {
  loaded: boolean;
  entry: {
    sessionId: string;
    nodeId: string;
    step: "sources" | "article" | "branch_suggestions" | null;
  } | null;
};

let feed: Feed = { loaded: false, entry: null };

/** Reports every observed card as on screen. Other files may leave a never-firing observer. */
class OnScreen {
  constructor(private readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void) {}
  observe() {
    this.callback([{ isIntersecting: true }]);
  }
  disconnect() {}
}

const realObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = OnScreen;
});

afterEach(() => {
  cleanup();
  feed = { loaded: false, entry: null };
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = realObserver;
});

async function openDisclosure(view: ReturnType<typeof render>, label: string | RegExp) {
  const details = view.getByText(label).closest("details") as HTMLDetailsElement;
  // The DOM queues a toggle event when `open` changes; dispatch one only if it never arrives.
  const toggled = new Promise<boolean>((resolve) => {
    details.addEventListener("toggle", () => resolve(true), { once: true });
    setTimeout(() => resolve(false), 20);
  });

  await act(async () => {
    details.open = true;
    if (!(await toggled)) fireEvent(details, new Event("toggle"));
  });

  return details;
}

function status(view: ReturnType<typeof render>) {
  return view.getByRole("status").textContent;
}

describe("Rabbit hole tool presence", () => {
  test("creation is visible while inputs stream, without premature navigation or success", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole"
        state="in-flight"
        input={{ query: "Black holes" }}
      />
    );

    expect(status(view)).toContain("Starting a rabbit hole");
    expect(view.getByText("Black holes")).toBeTruthy();
    expect(view.container.querySelector("[data-rabbit-hole-tool] .session-glyph")).toBeTruthy();
    expect(view.queryByRole("link")).toBeNull();
    expect(view.queryByText(/Rabbit hole created/)).toBeNull();
  });

  test("a new rabbit hole leads with its title and opens through its button", () => {
    const pin = mock(noop);
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole"
        state="complete"
        input={{ query: "Why do black holes have a geometry?" }}
        output={output}
        onTogglePin={pin}
      />
    );

    expect(status(view)).toBe("Rabbit hole created · writing the article");
    expect(view.getByText("Why do black holes have a geometry?")).toBeTruthy();
    expect(
      view
        .getByRole("list", { name: "The new rabbit hole" })
        .querySelector("li")
        ?.getAttribute("data-tone")
    ).toBe("generating");
    expect(view.getByRole("heading", { name: output.title })).toBeTruthy();
    expect(view.getByRole("link", { name: "Open rabbit hole" }).getAttribute("href")).toBe(
      "/rabbitholes?sessionId=session-123"
    );
    expect(view.container.querySelector("pre")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Pin tool output" }));
    expect(pin).toHaveBeenCalledTimes(1);
  });

  test("a new branch is drawn under its parent in its exploration", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole_node"
        state="complete"
        output={JSON.stringify({
          ...output,
          title: "Hawking radiation",
          parentTitle: "Event horizons",
          sessionTitle: "Black holes",
        })}
      />
    );

    expect(status(view)).toBe("Branch created · writing the article");
    expect(view.getByRole("heading", { name: "Black holes" })).toBeTruthy();
    expect(view.getByRole("link", { name: "Open rabbit hole" })).toBeTruthy();
    const tree = view.getByRole("list", { name: "Where the branch attaches" });
    const rows = Array.from(tree.querySelectorAll("li"));

    expect(rows.map((row) => row.getAttribute("data-tone"))).toEqual(["context", "generating"]);
    expect(rows[1]?.textContent).toContain("Hawking radiation");
  });

  test("the status line follows the shared feed: sources, writing, then ready from one read", async () => {
    const load = mock(async () => ({
      state: "ready" as const,
      keyPoints: ["Event horizons are one-way", "Spacetime curvature diverges"],
    }));
    const view = render(
      <RabbitHoleToolPresence
        loadNodeStatus={load}
        output={output}
        showToolDetails={false}
        state="complete"
        toolName="create_rabbit_hole"
        useGenerationFeed={() => feed}
        onOpenNode={noop}
      />
    );
    const rerender = () =>
      view.rerender(
        <RabbitHoleToolPresence
          loadNodeStatus={load}
          output={output}
          showToolDetails={false}
          state="complete"
          toolName="create_rabbit_hole"
          useGenerationFeed={() => ({ ...feed })}
          onOpenNode={noop}
        />
      );

    // Before the feed arrives, the tool's own snapshot.
    expect(status(view)).toBe("Rabbit hole created · writing the article");

    feed = {
      loaded: true,
      entry: { sessionId: "session-123", nodeId: "node-123", step: "sources" },
    };
    rerender();
    expect(status(view)).toBe("Rabbit hole created · finding sources");
    expect(view.container.querySelector("[data-rabbit-hole-status] .session-glyph")).toBeTruthy();

    feed = {
      loaded: true,
      entry: { sessionId: "session-123", nodeId: "node-123", step: "article" },
    };
    rerender();
    expect(status(view)).toBe("Rabbit hole created · writing the article");
    expect(load).not.toHaveBeenCalled();

    // The session leaves the feed: one read says how it ended.
    feed = { loaded: true, entry: null };
    rerender();
    await waitFor(() => expect(status(view)).toBe("Rabbit hole created · article ready"));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("session-123", "node-123");
    const node = view.getByRole("list", { name: "The new rabbit hole" }).querySelector("li");

    expect(node?.getAttribute("data-tone")).toBe("new");
    expect(node?.textContent).toContain("ready");

    // Key points come from that same read: no second request.
    fireEvent.click(view.getByRole("button", { name: "Key points" }));
    expect(view.getByText("Event horizons are one-way")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("a node that stopped moving reads as stalled, and an unreadable one claims nothing", async () => {
    feed = { loaded: true, entry: null };
    const stalled = render(
      <RabbitHoleToolPresence
        loadNodeStatus={async () => ({ state: "stalled" as const })}
        output={output}
        showToolDetails={false}
        state="complete"
        toolName="create_rabbit_hole"
        useGenerationFeed={() => feed}
        onOpenNode={noop}
      />
    );

    await waitFor(() => expect(status(stalled)).toBe("Rabbit hole created · article stalled"));
    stalled.unmount();

    const unreadable = render(
      <RabbitHoleToolPresence
        loadNodeStatus={async () => null}
        output={output}
        showToolDetails={false}
        state="complete"
        toolName="create_rabbit_hole"
        useGenerationFeed={() => feed}
        onOpenNode={noop}
      />
    );

    await waitFor(() => expect(status(unreadable)).toBe("Rabbit hole created"));
  });

  test("an off-screen card makes no status read", async () => {
    const original = globalThis.IntersectionObserver;
    const load = mock(async () => ({ state: "ready" as const, keyPoints: [] }));

    class OffScreen {
      observe() {}
      disconnect() {}
    }
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = OffScreen;
    feed = { loaded: true, entry: null };
    try {
      render(
        <RabbitHoleToolPresence
          loadNodeStatus={load}
          output={output}
          showToolDetails={false}
          state="complete"
          toolName="create_rabbit_hole"
          useGenerationFeed={() => feed}
          onOpenNode={noop}
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(load).not.toHaveBeenCalled();
    } finally {
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    }
  });

  test("key points opened while writing say so, without polling", async () => {
    const load = mock(async () => ({
      state: "working" as const,
      step: "article" as const,
      keyPoints: [],
    }));

    feed = {
      loaded: true,
      entry: { sessionId: "session-123", nodeId: "node-123", step: "article" },
    };
    const view = render(
      <RabbitHoleToolPresence
        loadNodeStatus={load}
        output={output}
        showToolDetails={false}
        state="complete"
        toolName="create_rabbit_hole"
        useGenerationFeed={() => feed}
        onOpenNode={noop}
      />
    );

    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Key points" }));
    });
    await waitFor(() =>
      expect(view.getByText("Key points appear once the article is written.")).toBeTruthy()
    );
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("tool details render only when enabled (dev instances)", async () => {
    const view = render(
      <RabbitHoleToolPresence
        output={output}
        showToolDetails={false}
        state="complete"
        toolName="get_rabbit_hole"
        onOpenNode={noop}
      />
    );

    expect(view.queryByText("Tool details")).toBeNull();
    view.rerender(
      <RabbitHoleToolPresence
        output={output}
        showToolDetails
        state="complete"
        toolName="get_rabbit_hole"
        onOpenNode={noop}
      />
    );
    expect(view.container.querySelector("pre")).toBeNull();
    await openDisclosure(view, "Tool details");
    expect(view.container.querySelector("pre")?.textContent).toContain("session-123");
  });

  test("a returned ok:false is an error even when the transport reports output-available", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole"
        state="complete"
        output={{ ...output, ok: false, error: "Spending limit reached." }}
      />
    );

    expect(status(view)).toContain("Rabbit hole action failed");
    expect(view.getByText("Spending limit reached.")).toBeTruthy();
    expect(view.queryByRole("link")).toBeNull();
    expect(view.queryByText("Key points")).toBeNull();
  });

  test("transport errors and malformed historical output do not claim creation", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole"
        state="error"
        output="Connection interrupted."
      />
    );

    expect(view.getByText("Connection interrupted.")).toBeTruthy();
    expect(view.queryByRole("link")).toBeNull();
    view.rerender(
      <OrganicToolCallPresence toolName="create_rabbit_hole" state="complete" output="unexpected" />
    );
    expect(status(view)).toBe("Rabbit hole response");
    expect(view.queryByText(/Rabbit hole created/)).toBeNull();
  });

  test("drawer navigation uses its existing event", () => {
    const opened = mock(noop);

    window.addEventListener(RABBIT_HOLE_OPEN_NODE_EVENT, opened);
    try {
      const view = render(
        <OrganicToolCallPresence
          toolName="navigate_rabbit_hole_node"
          state="complete"
          output={{ ok: true, activeNodeId: "node-456", title: "A branch" }}
        />
      );

      expect(view.getByText("A branch")).toBeTruthy();
      fireEvent.click(view.getByRole("button", { name: "View article" }));
      expect(opened).toHaveBeenCalledTimes(1);
      expect((opened.mock.calls[0] as unknown as [CustomEvent]).at(0)?.detail).toEqual({
        nodeId: "node-456",
      });
    } finally {
      window.removeEventListener(RABBIT_HOLE_OPEN_NODE_EVENT, opened);
    }
  });

  test("old drawer generation keeps its node action", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="generate_rabbit_hole_node"
        state="complete"
        output={output}
      />
    );

    expect(view.getByRole("button", { name: "View article" })).toBeTruthy();
  });

  test("search shows top explorations with the articles that matched, the rest folded", async () => {
    const results = Array.from({ length: 8 }, (_, index) => ({
      sessionId: `session-${index}`,
      title: `Persona study ${index}`,
      description: `How memory shapes persona ${index}`,
      nodeCount: index + 2,
      updatedAt: "2026-11-02T10:00:00.000Z",
      matchedTerms: ["persona", "memory"],
      matchingNodes: [
        { nodeId: `n-${index}-a`, title: "Memory extraction" },
        { nodeId: `n-${index}-b`, title: "Persona tone" },
      ],
      url: "https://untrusted.example",
    }));
    const view = render(
      <OrganicToolCallPresence
        toolName="search_rabbit_holes"
        state="complete"
        input={{ query: "persona memory" }}
        output={{ ok: true, query: "persona memory", results }}
      />
    );

    // The query is quiet context on the label line; the visible "Searched…" label is gone.
    expect(view.getByText("persona memory").closest("header")).toBeTruthy();
    expect(view.getByText(/Searched your rabbit holes/).className).toBe("sr-only");
    expect(status(view)).toBe("8 results");
    // Folded: four title rows, no links until a result is opened.
    const rows = view.getAllByRole("button", { name: /Persona study/ });

    expect(rows).toHaveLength(4);
    expect(view.queryAllByRole("link")).toHaveLength(0);
    expect(view.queryByText("How memory shapes persona 0")).toBeNull();
    expect(view.getByText("2 articles · Nov 2")).toBeTruthy();
    expect(view.container.querySelectorAll("mark").length).toBeGreaterThan(0);

    fireEvent.click(rows[0]!);
    expect(rows[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(view.getByRole("list", { name: "Matching articles in Persona study 0" })).toBeTruthy();
    expect(view.getByRole("link", { name: "Open rabbit hole" }).getAttribute("href")).toBe(
      "/rabbitholes?sessionId=session-0"
    );

    // The rest join the same list; the toggle stays at the foot and turns into Show less.
    fireEvent.click(view.getByRole("button", { name: "Show 4 more" }));
    expect(view.getAllByRole("button", { name: /Persona study/ })).toHaveLength(8);
    const toggle = view.getByRole("button", { name: "Show less" });

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.previousElementSibling?.tagName).toBe("OL");
    fireEvent.click(toggle);
    expect(view.getAllByRole("button", { name: /Persona study/ })).toHaveLength(4);

    view.rerender(
      <OrganicToolCallPresence
        toolName="search_rabbit_holes"
        state="complete"
        output={{ ok: true, results: [] }}
      />
    );
    expect(status(view)).toBe("None found");
    expect(view.getByText("Nothing in your rabbit holes matches this yet.")).toBeTruthy();
  });

  test("a session read is drawn as its article tree", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="get_rabbit_hole"
        state="complete"
        output={{
          ok: true,
          sessionId: "s1",
          title: "Black holes",
          description: "From horizons to radiation",
          updatedAt: "2026-11-02T10:00:00.000Z",
          rootNodeId: "a",
          generatingNodeId: "c",
          nodeCount: 3,
          nodes: [
            { nodeId: "a", title: "Black holes", parentNodeId: null },
            { nodeId: "c", title: "Hawking radiation", parentNodeId: "b" },
            { nodeId: "b", title: "Event horizons", parentNodeId: "a" },
          ],
        }}
      />
    );

    const rows = Array.from(
      view.getByRole("list", { name: "Articles in Black holes" }).querySelectorAll("li")
    );

    expect(rows.map((row) => row.textContent)).toEqual([
      "Black holes",
      "Event horizons",
      "Hawking radiationwriting",
    ]);
    expect(rows.map((row) => row.getAttribute("data-tone"))).toEqual(["root", null, "generating"]);
    expect(status(view)).toBe("3 articles · updated Nov 2");
  });

  test("an article read shows its key points first, with the outline folded", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="get_rabbit_hole_node"
        state="complete"
        output={{
          ok: true,
          sessionId: "s1",
          nodeId: "b",
          title: "Event horizons",
          userQuestion: "What is an event horizon?",
          childNodeIds: ["c"],
          sections: [
            { index: 0, id: "intro", heading: "Introduction" },
            { index: 1, id: "geometry", heading: "Geometry" },
          ],
          keyTakeaways: ["One", "Two", "Three", "Four"],
        }}
      />
    );

    expect(view.getByText("Three")).toBeTruthy();
    expect(view.queryByText("Four")).toBeNull();
    expect(status(view)).toBe("Article read · 2 sections · 1 branch");
    fireEvent.click(view.getByRole("button", { name: "Show 1 more" }));
    expect(view.getByText("Four")).toBeTruthy();
    expect(view.getByRole("button", { name: "Show less" })).toBeTruthy();
    expect(view.getByText("Outline")).toBeTruthy();
  });

  test("multiple marks have no colliding SVG ids, and unknown tools retain their own renderer", () => {
    const view = render(
      <>
        <OrganicToolCallPresence toolName="create_rabbit_hole" state="in-flight" />
        <OrganicToolCallPresence toolName="get_rabbit_hole" state="complete" output={output} />
      </>
    );

    expect(view.container.querySelectorAll("svg [id]")).toHaveLength(0);
    expect(isRabbitHoleToolName("CREATE_RABBIT_HOLE")).toBe(true);
    expect(isRabbitHoleToolName("other_rabbit_hole_tool")).toBe(false);
  });
});

describe("Generic tool pill details", () => {
  test("raw output expands only when tool details are enabled", () => {
    const view = render(
      <OrganicToolCallPresence
        output={{ answer: 42 }}
        showToolDetails={false}
        state="complete"
        toolName="web_search"
      />
    );

    expect(view.container.querySelector("[aria-expanded]")).toBeNull();
    view.rerender(
      <OrganicToolCallPresence
        output={{ answer: 42 }}
        showToolDetails
        state="complete"
        toolName="web_search"
      />
    );
    const toggle = view.container.querySelector("[aria-expanded]") as HTMLElement;

    fireEvent.click(toggle);
    expect(view.container.querySelector("pre")?.textContent).toContain("42");
  });
});

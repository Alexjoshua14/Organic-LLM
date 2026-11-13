import { afterEach, describe, expect, mock, test } from "bun:test";
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

afterEach(cleanup);

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

  test("a new rabbit hole leads with its title, linked only to the internal destination", () => {
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
    const link = view.getByRole("link", { name: `Open rabbit hole: ${output.title}` });

    expect(link.textContent).toBe(output.title);
    expect(link.getAttribute("href")).toBe("/rabbitholes?sessionId=session-123");
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
    expect(view.getByRole("link", { name: "Open rabbit hole: Black holes" })).toBeTruthy();
    const tree = view.getByRole("list", { name: "Where the branch attaches" });
    const rows = Array.from(tree.querySelectorAll("li"));

    expect(rows.map((row) => row.getAttribute("data-tone"))).toEqual(["context", "generating"]);
    expect(rows[1]?.textContent).toContain("Hawking radiation");
  });

  test("key points stay folded and load once, only when opened", async () => {
    const load = mock(async () => ["Event horizons are one-way", "Spacetime curvature diverges"]);
    const view = render(
      <RabbitHoleToolPresence
        loadKeyPoints={load}
        output={output}
        showToolDetails={false}
        state="complete"
        toolName="create_rabbit_hole"
        onOpenNode={noop}
      />
    );

    expect(load).not.toHaveBeenCalled();
    await openDisclosure(view, "Key points");
    await waitFor(() => expect(view.getByText("Event horizons are one-way")).toBeTruthy());
    expect(load).toHaveBeenCalledWith("session-123", "node-123");
  });

  test("unwritten articles say so quietly rather than polling", async () => {
    const load = mock(async () => [] as string[]);
    const view = render(
      <RabbitHoleToolPresence
        loadKeyPoints={load}
        output={output}
        showToolDetails={false}
        state="complete"
        toolName="create_rabbit_hole"
        onOpenNode={noop}
      />
    );

    await openDisclosure(view, "Key points");
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

    expect(view.getByText("“persona memory”")).toBeTruthy();
    expect(status(view)).toBe("8 rabbit holes");
    expect(view.getAllByRole("link")).toHaveLength(3);
    expect(view.getByRole("list", { name: "Matching articles in Persona study 0" })).toBeTruthy();
    expect(view.getByText("2 articles · Nov 2")).toBeTruthy();
    expect(view.container.querySelectorAll("mark").length).toBeGreaterThan(0);

    await openDisclosure(view, "5 more");
    const links = view.getAllByRole("link");

    expect(links).toHaveLength(8);
    expect(
      links.every((link) => link.getAttribute("href")?.startsWith("/rabbitholes?sessionId="))
    ).toBe(true);

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
    expect(view.getByText("1 more key points")).toBeTruthy();
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

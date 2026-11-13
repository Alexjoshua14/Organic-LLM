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

describe("Rabbit hole tool presence", () => {
  test("creation is visible while inputs stream, without premature navigation or success", () => {
    const view = render(
      <OrganicToolCallPresence toolName="create_rabbit_hole" state="in-flight" />
    );

    expect(view.getByRole("status").textContent).toContain("Creating a rabbit hole");
    expect(view.container.querySelector("[data-rabbit-hole-tool] .session-glyph")).toBeTruthy();
    expect(view.queryByRole("link")).toBeNull();
    expect(view.queryByText(/Rabbit hole created/)).toBeNull();
  });

  test("scheduled creation is one compact row with an internal open action", () => {
    const pin = mock(noop);
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole"
        state="complete"
        output={output}
        onTogglePin={pin}
      />
    );

    expect(view.getByRole("status").textContent).toBe("Rabbit hole created · writing article");
    expect(view.getByText(output.title)).toBeTruthy();
    expect(view.getByRole("link", { name: "Open rabbit hole" }).getAttribute("href")).toBe(
      "/rabbitholes?sessionId=session-123"
    );
    expect(view.container.querySelector("pre")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Pin tool output" }));
    expect(pin).toHaveBeenCalledTimes(1);
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

    expect(view.getByRole("status").textContent).toContain("Rabbit hole action failed");
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
    expect(view.getByRole("status").textContent).toBe("Rabbit hole response");
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
      fireEvent.click(view.getByRole("button", { name: "View article" }));
      expect(opened).toHaveBeenCalledTimes(1);
      expect((opened.mock.calls[0] as unknown as [CustomEvent]).at(0)?.detail).toEqual({
        nodeId: "node-456",
      });
    } finally {
      window.removeEventListener(RABBIT_HOLE_OPEN_NODE_EVENT, opened);
    }
  });

  test("node creation links to its owning session and old drawer generation keeps the node action", () => {
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole_node"
        state="complete"
        output={JSON.stringify(output)}
      />
    );

    expect(view.getByText(/Branch created/)).toBeTruthy();
    expect(view.getByRole("link").getAttribute("href")).toBe("/rabbitholes?sessionId=session-123");
    view.rerender(
      <OrganicToolCallPresence
        toolName="generate_rabbit_hole_node"
        state="complete"
        output={output}
      />
    );
    expect(view.getByRole("button", { name: "View article" })).toBeTruthy();
  });

  test("search is one row; bounded, safe results fold behind a disclosure", async () => {
    const results = Array.from({ length: 8 }, (_, index) => ({
      sessionId: `session-${index}`,
      title: `Result ${index}`,
      description: `About result ${index}`,
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

    expect(view.getByText("persona memory")).toBeTruthy();
    expect(view.getByRole("status").textContent).toBe("Rabbit holes searched · 8 found");
    expect(view.queryAllByRole("link")).toHaveLength(0);
    await openDisclosure(view, "8 results");
    const links = view.getAllByRole("link");

    expect(links).toHaveLength(6);
    expect(view.getByText("About result 0")).toBeTruthy();
    expect(view.getByText("Showing 6 of 8")).toBeTruthy();
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
    expect(view.getByRole("status").textContent).toBe("No rabbit holes found");
    expect(view.queryByText(/results?$/)).toBeNull();
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

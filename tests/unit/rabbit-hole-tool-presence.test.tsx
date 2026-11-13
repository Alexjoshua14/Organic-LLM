import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { render } from "../helpers/render";

import {
  OrganicToolCallPresence,
  RABBIT_HOLE_OPEN_NODE_EVENT,
} from "@/components/chat/organic-tool-call-presence";
import { isRabbitHoleToolName } from "@/components/chat/rabbit-hole-tool-presence";

const output = {
  ok: true,
  sessionId: "session-123",
  nodeId: "node-123",
  title: "The geometry of a black hole",
  status: "generating",
  url: "javascript:alert(1)",
};

afterEach(cleanup);

describe("Rabbit hole tool presence", () => {
  test("creation is visible while inputs stream, without premature navigation or success", () => {
    const view = render(
      <OrganicToolCallPresence toolName="create_rabbit_hole" state="in-flight" />
    );

    expect(view.getByRole("status").textContent).toContain("Creating a rabbit hole");
    expect(view.container.querySelector("[data-rabbit-hole-tool]")).toBeTruthy();
    expect(view.container.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    expect(view.queryByRole("link")).toBeNull();
    expect(view.queryByText("Rabbit hole created")).toBeNull();
  });

  test("scheduled creation reports background generation and opens only the internal destination", () => {
    const pin = mock(() => {});
    const view = render(
      <OrganicToolCallPresence
        toolName="create_rabbit_hole"
        state="complete"
        output={output}
        onTogglePin={pin}
      />
    );

    expect(view.getByRole("status").textContent).toContain("Rabbit hole created");
    expect(view.getByText(output.title)).toBeTruthy();
    expect(view.getByText(/Article generating in the background/)).toBeTruthy();
    expect(view.getByRole("link", { name: "Open rabbit hole" }).getAttribute("href")).toBe(
      "/rabbitholes?sessionId=session-123"
    );
    expect(view.container.querySelector("pre")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Pin tool output" }));
    expect(pin).toHaveBeenCalledTimes(1);
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
    expect(view.queryByText(/Article generating/)).toBeNull();
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
    expect(view.queryByText("Rabbit hole created")).toBeNull();
  });

  test("drawer navigation uses its existing event and does not also expand tool details", () => {
    const opened = mock(() => {});
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
      expect(view.container.querySelector("details")?.open).toBe(false);
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

    expect(view.getByText("Branch created")).toBeTruthy();
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

  test("search shows a bounded set of safe destinations and an accurate empty state", () => {
    const results = Array.from({ length: 8 }, (_, index) => ({
      sessionId: `session-${index}`,
      title: `Result ${index}`,
      url: "https://untrusted.example",
    }));
    const view = render(
      <OrganicToolCallPresence
        toolName="search_rabbit_holes"
        state="complete"
        output={{ ok: true, results }}
      />
    );

    expect(view.getAllByRole("link")).toHaveLength(4);
    expect(view.getByText("8 rabbit holes returned.")).toBeTruthy();
    expect(
      view
        .getAllByRole("link")
        .every((link) => link.getAttribute("href")?.startsWith("/rabbitholes?sessionId="))
    ).toBe(true);
    view.rerender(
      <OrganicToolCallPresence
        toolName="search_rabbit_holes"
        state="complete"
        output={{ ok: true, results: [] }}
      />
    );
    expect(view.getByText("No rabbit holes found.")).toBeTruthy();
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

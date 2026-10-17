import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { MemorySearchToolResultCard } from "@/components/chat/memory-search-tool-result";
import { render } from "../helpers/render";

afterEach(() => cleanup());

describe("memory search evidence disclosure", () => {
  test("separates query and count, expands full matches, and keeps pinning independent", () => {
    const query =
      "Organic LLM project purpose, features, and architecture, including previous research";
    const onTogglePin = mock(() => {});
    const view = render(
      <MemorySearchToolResultCard
        isPinned={false}
        onTogglePin={onTogglePin}
        parsed={{
          status: "ok",
          query,
          count: 3,
          memories: [
            { id: "1", memory: "A complete first memory." },
            { id: "2", memory: "A complete second memory." },
            { id: "3", memory: "A complete third memory." },
          ],
        }}
      />
    );
    const trigger = view.getByRole("button", { name: /Memory search/ });
    expect(view.getByText("3 memories")).toBeTruthy();
    expect(view.getByText(query)).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(view.queryByText("A complete first memory.")).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const details = document.getElementById(trigger.getAttribute("aria-controls")!);
    expect(details?.querySelectorAll("li")).toHaveLength(3);
    expect(view.getByText("A complete third memory.")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Pin tool output" }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger);
    expect(view.queryByText("A complete third memory.")).toBeNull();
  });

  test("uses a singular count and an explicit empty result without exposing pin controls when disabled", () => {
    const view = render(
      <MemorySearchToolResultCard
        isPinned={false}
        showPin={false}
        onTogglePin={() => {}}
        parsed={{
          status: "ok",
          query: "A preference",
          count: 1,
          memories: [{ id: "1", memory: "A preference." }],
        }}
      />
    );
    expect(view.getByText("1 memory")).toBeTruthy();
    expect(view.queryByRole("button", { name: /Pin/ })).toBeNull();
    view.rerender(
      <MemorySearchToolResultCard
        isPinned={false}
        showPin={false}
        onTogglePin={() => {}}
        parsed={{ status: "ok", query: "No matching preference", count: 0, memories: [] }}
      />
    );
    expect(view.getByText("0 memories")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /Memory search/ }));
    expect(view.getByText("No memories matched this query.")).toBeTruthy();
  });

  test("labels a failed search and preserves its inspectable error", () => {
    const view = render(
      <MemorySearchToolResultCard
        isPinned={false}
        onTogglePin={() => {}}
        parsed={{ status: "error", message: "The memory service is unavailable." }}
      />
    );
    expect(view.getByText("Failed")).toBeTruthy();
    expect(view.queryByText("The memory service is unavailable.")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Memory search/ }));
    expect(view.getByText("The memory service is unavailable.")).toBeTruthy();
  });
});

// Run in an isolated Bun process from tests/integration/memory-lens.test.ts.
// Real lens, cards, feedback controls, sort menu, and pagination; only server boundaries are mocked.
import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import type { MemoryItem } from "mem0ai/oss";
import type { MemoryFeedbackRow, RecordMemoryFeedbackInput } from "@/lib/schemas/memory-quality";
import type { SearchResultType } from "@/lib/schemas/memory";
import type { Result } from "@/types";

import { render } from "../helpers/render";

type SearchResponse = Result<SearchResultType, string>;
const initial: MemoryItem[] = [
  { id: "older", memory: "Green tea preference", score: 0.95, createdAt: "2026-09-01T00:00:00Z" },
  { id: "newer", memory: "Coffee preference", score: 0.3, createdAt: "2026-09-24T00:00:00Z" },
];
const response = (results: MemoryItem[]): SearchResponse => ({
  data: { results, relations: [] },
  error: null,
});
const list = mock(async (): Promise<SearchResponse> => response(initial));
const search = mock(
  async (_query: string, _limit?: number): Promise<SearchResponse> => response(initial)
);
const remove = mock(
  async (_id: string): Promise<Result<boolean, string>> => ({ data: true, error: null })
);
const votes = new Map<string, MemoryFeedbackRow>();
const vote = mock(
  async (input: RecordMemoryFeedbackInput): Promise<Result<MemoryFeedbackRow, string>> => {
    const previous = votes.get(input.memoryId);
    const row: MemoryFeedbackRow = {
      id: "e4180f0e-89f4-49cf-a094-3356c1308799",
      user_id: "owner",
      memory_id: input.memoryId,
      signal: input.signal,
      source: input.source,
      note: previous?.signal === input.signal ? previous.note : null,
      note_approved_at: previous?.signal === input.signal ? previous.note_approved_at : null,
      shared_memory: null,
      memory_shared_at: null,
      revision: (previous?.revision ?? 0) + 1,
      created_at: "2026-09-24T00:00:00Z",
      updated_at: "2026-09-24T00:00:00Z",
    };
    votes.set(input.memoryId, row);

    return { data: row, error: null };
  }
);
const neverSave = mock(async () => ({ data: null, error: "Unexpected save" }));

mock.module("@/lib/memory/operations", () => ({
  getCurrentUserMemories: list,
  getCurrentUserMemoriesBySearch: search,
  deleteMemoryForCurrentUser: remove,
}));
mock.module("@/components/memory/MemoryLensPageOverview", () => ({
  MemoryLensPageOverview: () => null,
  clearMemoryLensOverviewClientCache: () => {},
}));
mock.module("@/app/actions/memory-feedback", () => ({
  actionRecordMemoryFeedback: vote,
  actionApproveFeedbackNote: neverSave,
  actionRemoveFeedbackNote: neverSave,
  actionRemoveMemoryFeedback: neverSave,
  actionPreviewFeedbackMemory: neverSave,
  actionShareFeedbackMemory: neverSave,
  actionRemoveSharedFeedbackMemory: neverSave,
}));

// Browser APIs used by Radix that JSDOM does not install on globalThis.
Object.assign(globalThis, {
  CustomEvent: window.CustomEvent,
  NodeFilter: window.NodeFilter,
  HTMLInputElement: window.HTMLInputElement,
  HTMLFormElement: window.HTMLFormElement,
  HTMLSelectElement: window.HTMLSelectElement,
  DocumentFragment: window.DocumentFragment,
  Option: window.Option,
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
HTMLElement.prototype.scrollIntoView = () => {};
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.releasePointerCapture = () => {};

const { MemoryLens } = await import("@/components/memory/memory-lens");
const { MemoryLensCard } = await import("@/components/memory/memory-lens-card");
const originalFetch = globalThis.fetch;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

beforeEach(() => {
  list.mockReset().mockResolvedValue(response(initial));
  search.mockReset().mockResolvedValue(response(initial));
  remove.mockReset().mockResolvedValue({ data: true, error: null });
  vote.mockClear();
  neverSave.mockClear();
  votes.clear();
  globalThis.fetch = mock(async (url: string | URL | Request) => {
    const parsed = new URL(String(url), "http://localhost");
    if (parsed.pathname !== "/api/memory/feedback") throw new Error("Unexpected request");

    return Response.json({ row: votes.get(parsed.searchParams.get("memoryId")!) ?? null });
  }) as typeof fetch;
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe("memory search page", () => {
  test("initial results show real card text in recency order", async () => {
    const ui = render(<MemoryLens />);
    await waitFor(() => expect(ui.getByRole("list", { name: "Memory list" })).toBeTruthy());
    const items = within(ui.getByRole("list", { name: "Memory list" })).getAllByRole("listitem");

    expect(items[0]!.textContent).toContain("Coffee preference");
    expect(items[1]!.textContent).toContain("Green tea preference");
    expect(ui.getByText("2 memories")).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(1);
    expect(search).not.toHaveBeenCalled();
  });

  test("typing is debounced for 350 ms, uses the final trimmed query, and clearing returns to the list", async () => {
    jest.useFakeTimers();
    const ui = render(<MemoryLens />);
    await act(async () => {});
    const input = ui.getByRole("searchbox", { name: "Search memories" });

    for (const query of ["t", "te", " tea "]) {
      fireEvent.change(input, { target: { value: query } });
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    expect(search).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(249);
    });
    expect(search).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("tea", 100);
    fireEvent.change(input, { target: { value: "   " } });
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenCalledTimes(1);
    ui.unmount();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(search).toHaveBeenCalledTimes(1);
  });

  test("unmount cancels an unsent debounced search", async () => {
    jest.useFakeTimers();
    const ui = render(<MemoryLens />);
    await act(async () => {});
    fireEvent.change(ui.getByRole("searchbox"), { target: { value: "tea" } });
    ui.unmount();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(search).not.toHaveBeenCalled();
  });

  test("a slow older search cannot overwrite the newest query's results", async () => {
    const old = deferred<SearchResponse>();
    search.mockImplementationOnce(() => old.promise);
    const ui = render(<MemoryLens searchQuery="tea" />);
    await waitFor(() => expect(search).toHaveBeenCalledWith("tea", 5));
    search.mockResolvedValueOnce(response([{ id: "new-result", memory: "Fresh coffee result" }]));
    ui.rerender(<MemoryLens searchQuery="coffee" />);
    await waitFor(() => expect(ui.getByText("Fresh coffee result")).toBeTruthy());
    await act(async () => {
      old.resolve(response([{ id: "stale-result", memory: "Stale tea result" }]));
    });

    expect(ui.getByText("Fresh coffee result")).toBeTruthy();
    expect(ui.queryByText("Stale tea result")).toBeNull();
  });

  test("a stale failure cannot erase a later successful search", async () => {
    const old = deferred<SearchResponse>();
    search.mockImplementationOnce(() => old.promise);
    const ui = render(<MemoryLens searchQuery="old" />);
    search.mockResolvedValueOnce(response([{ id: "latest", memory: "Latest memory" }]));
    ui.rerender(<MemoryLens searchQuery="new" />);
    await waitFor(() => expect(ui.getByText("Latest memory")).toBeTruthy());
    await act(async () => {
      old.resolve({ data: null, error: "Old failure" });
    });
    expect(ui.getByText("Latest memory")).toBeTruthy();
    expect(ui.queryByText("Old failure")).toBeNull();
  });

  test("refresh fetches the active query again and replaces old results", async () => {
    const ui = render(<MemoryLens searchQuery="tea" searchLimit={25} />);
    await waitFor(() => expect(ui.getByText("Green tea preference")).toBeTruthy());
    search.mockResolvedValueOnce(response([{ id: "updated", memory: "Updated tea preference" }]));
    fireEvent.click(ui.getByRole("button", { name: "Refresh memory list" }));
    await waitFor(() => expect(ui.getByText("Updated tea preference")).toBeTruthy());
    expect(ui.queryByText("Green tea preference")).toBeNull();
    expect(search).toHaveBeenLastCalledWith("tea", 25);
  });

  test("relevance and recency menus reorder displayed cards without another search", async () => {
    const ui = render(<MemoryLens searchQuery="preference" />);
    await waitFor(() => expect(ui.getByText("Green tea preference")).toBeTruthy());
    fireEvent.keyDown(ui.getByRole("combobox", { name: "Sort by" }), { key: "ArrowDown" });
    fireEvent.click(await ui.findByRole("option", { name: "Relevance" }));
    let items = within(ui.getByRole("list", { name: "Memory list" })).getAllByRole("listitem");
    expect(items[0]!.textContent).toContain("Green tea preference");
    expect(ui.getByText("95% match")).toBeTruthy();
    fireEvent.keyDown(ui.getByRole("combobox", { name: "Sort by" }), { key: "ArrowDown" });
    fireEvent.click(await ui.findByRole("option", { name: "Recently added" }));
    items = within(ui.getByRole("list", { name: "Memory list" })).getAllByRole("listitem");
    expect(items[0]!.textContent).toContain("Coffee preference");
    expect(ui.queryByText("95% match")).toBeNull();
    expect(search).toHaveBeenCalledTimes(1);
  });

  test("a new query resets pagination to its first page", async () => {
    const many = Array.from({ length: 21 }, (_, index) => ({
      id: `memory-${index}`,
      memory: `Result ${index}`,
    }));
    search.mockResolvedValue(response(many));
    const ui = render(<MemoryLens paginate searchQuery="first" searchLimit={100} />);
    await waitFor(() => expect(ui.getByText("Showing 1–10 of 21")).toBeTruthy());
    fireEvent.click(ui.getByRole("button", { name: "Next page" }));
    expect(ui.getByText("Showing 11–20 of 21")).toBeTruthy();
    ui.rerender(<MemoryLens paginate searchQuery="second" searchLimit={100} />);
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("second", 100));
    await waitFor(() => expect(ui.getByText("Showing 1–10 of 21")).toBeTruthy());
    expect(ui.getByText("Result 0")).toBeTruthy();
    expect(ui.queryByText("Result 10")).toBeNull();
  });

  test("rate-limit errors are visible and refresh can recover", async () => {
    search.mockResolvedValueOnce({ data: null, error: "Too many search requests" });
    const ui = render(<MemoryLens searchQuery="tea" />);
    await waitFor(() =>
      expect(ui.getByRole("alert").textContent).toContain("Too many search requests")
    );
    fireEvent.click(ui.getByRole("button", { name: "Refresh memory list" }));
    await waitFor(() => expect(ui.getByText("Green tea preference")).toBeTruthy());
    expect(ui.queryByRole("alert")).toBeNull();
  });

  test("a search with no matches has a search-specific empty state", async () => {
    search.mockResolvedValueOnce(response([]));
    const ui = render(<MemoryLens searchQuery="nothing" />);
    await waitFor(() => expect(ui.getByText("No memories match this search.")).toBeTruthy());
    expect(ui.queryByText(/No memories yet/)).toBeNull();
  });
});

describe("memory deletion and voting", () => {
  test("an in-flight refresh cannot put a successfully deleted memory back", async () => {
    const ui = render(<MemoryLens />);
    await waitFor(() => expect(ui.getByText("Coffee preference")).toBeTruthy());
    const pendingRefresh = deferred<SearchResponse>();
    const card = ui.getByText("Coffee preference").closest("article")!;

    fireEvent.click(within(card).getByRole("button", { name: "Remove from memory" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("newer"));
    list.mockImplementationOnce(() => pendingRefresh.promise);
    fireEvent.click(ui.getByRole("button", { name: "Refresh memory list" }));
    await waitFor(() => expect(ui.queryByText("Coffee preference") === null).toBe(true));
    await act(async () => {
      pendingRefresh.resolve(response(initial));
    });
    expect(ui.queryByText("Coffee preference")).toBeNull();
    expect(ui.getByText("Green tea preference")).toBeTruthy();
  });

  test("deleting the last item on the final page moves back to a populated page", async () => {
    list.mockResolvedValue(
      response(
        Array.from({ length: 11 }, (_, index) => ({
          id: `memory-${index}`,
          memory: `Page result ${index}`,
        }))
      )
    );
    const ui = render(<MemoryLens paginate />);
    await waitFor(() => expect(ui.getByText("Showing 1–10 of 11")).toBeTruthy());
    fireEvent.click(ui.getByRole("button", { name: "Next page" }));
    expect(ui.getByText("Showing 11–11 of 11")).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Remove from memory" }));
    await waitFor(() => expect(ui.queryByText("Page result 10") === null).toBe(true));
    expect(ui.getByText("Showing 1–10 of 10")).toBeTruthy();
    expect(ui.getByText("Page result 0")).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(1);
  });

  test("repeated clicks while deletion is pending issue only one delete", async () => {
    const pendingDelete = deferred<Result<boolean, string>>();
    remove.mockImplementationOnce(() => pendingDelete.promise);
    const deleted = mock(() => {});
    const ui = render(<MemoryLensCard memory={initial[0]!} onDeleted={deleted} />);
    const button = ui.getByRole("button", { name: "Remove from memory" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(deleted).not.toHaveBeenCalled();
    expect(button.hasAttribute("disabled")).toBe(true);
    await act(async () => {
      pendingDelete.resolve({ data: true, error: null });
    });
    await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1));
  });

  test("successful deletion removes only the selected result and updates the visible count", async () => {
    const ui = render(<MemoryLens />);
    await waitFor(() => expect(ui.getByText("Coffee preference")).toBeTruthy());
    const card = ui.getByText("Coffee preference").closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "Remove from memory" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("newer"));
    await waitFor(() => expect(ui.queryByText("Coffee preference") === null).toBe(true));
    expect(ui.getByText("Green tea preference")).toBeTruthy();
    expect(ui.getByText("1 memory")).toBeTruthy();
    expect(vote).not.toHaveBeenCalled();
  });

  test.each(["error", "false", "throw"])(
    "failed deletion (%s) keeps the card, reports an error, and allows retry",
    async (failure) => {
      if (failure === "throw") remove.mockRejectedValueOnce(new Error("Offline"));
      else
        remove.mockResolvedValueOnce({
          data: false,
          error: failure === "error" ? "Too many delete requests" : null,
        });
      const deleted = mock(() => {});
      const ui = render(<MemoryLensCard memory={initial[0]!} onDeleted={deleted} />);
      fireEvent.click(ui.getByRole("button", { name: "Remove from memory" }));
      await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
      expect(deleted).not.toHaveBeenCalled();
      expect(ui.getByText("Green tea preference")).toBeTruthy();
      expect(ui.getByRole("button", { name: "Remove from memory" }).hasAttribute("disabled")).toBe(
        false
      );
      fireEvent.click(ui.getByRole("button", { name: "Remove from memory" }));
      await waitFor(() => expect(deleted).toHaveBeenCalledWith("older"));
      expect(remove).toHaveBeenCalledTimes(2);
    }
  );

  test("up/down votes target the right memory, one selected vote is shown, and repeating it does not write again", async () => {
    const ui = render(<MemoryLensCard memory={initial[0]!} />);
    const up = ui.getByRole("button", { name: "Good memory" });
    await waitFor(() => expect(up.hasAttribute("disabled")).toBe(false));
    fireEvent.click(up);
    await waitFor(() => expect(up.getAttribute("aria-pressed")).toBe("true"));
    expect(vote).toHaveBeenLastCalledWith({
      memoryId: "older",
      signal: "up",
      source: "memory_lens",
    });
    fireEvent.click(ui.getByRole("button", { name: "Close feedback" }));
    fireEvent.click(up);
    expect(vote).toHaveBeenCalledTimes(1);
    fireEvent.click(ui.getByRole("button", { name: "Close feedback" }));
    const down = ui.getByRole("button", { name: "Bad memory" });
    fireEvent.click(down);
    await waitFor(() => expect(down.getAttribute("aria-pressed")).toBe("true"));
    expect(up.getAttribute("aria-pressed")).toBe("false");
    expect(vote).toHaveBeenLastCalledWith({
      memoryId: "older",
      signal: "down",
      source: "memory_lens",
    });
    expect(neverSave).not.toHaveBeenCalled();
  });

  test("a failed vote shows an error without pretending it was saved", async () => {
    vote.mockResolvedValueOnce({ data: null, error: "Too many feedback requests" });
    const ui = render(<MemoryLensCard memory={initial[0]!} />);
    const down = ui.getByRole("button", { name: "Bad memory" });
    await waitFor(() => expect(down.hasAttribute("disabled")).toBe(false));
    fireEvent.click(down);
    await waitFor(() =>
      expect(ui.getByRole("alert").textContent).toBe("Too many feedback requests")
    );
    expect(down.getAttribute("aria-pressed")).toBe("false");
    expect(ui.queryByText("Vote saved")).toBeNull();
  });
});

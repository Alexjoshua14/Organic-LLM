import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

import { createMockFetch } from "../helpers/mock-fetch";
import { render } from "../helpers/render";

const authState: { isLoaded: boolean; userId: string | null } = { isLoaded: true, userId: "user_a" };

mock.module("@/lib/auth/use-clerk-user-id", () => ({
  useClerkUserId: () => ({ ...authState }),
}));

import {
  ChatProvider,
  useSharedChatContext,
} from "@/lib/context/chat-context";

function TestConsumer() {
  const {
    sidebarChats,
    isSidebarChatsLoading,
    sidebarChatsError,
    hasMoreSidebarChats,
    refreshSidebarChats,
    loadMoreSidebarChats,
    updateSidebarChat,
    removeSidebarChat,
  } = useSharedChatContext();
  const chats = sidebarChats ?? [];

  return (
    <div>
      <div data-testid="loading">{String(isSidebarChatsLoading)}</div>
      <div data-testid="error">{sidebarChatsError?.message ?? ""}</div>
      <ul data-testid="threads">
        {chats.map((thread) => (
          <li key={thread.id}>
            {thread.title}|{String(thread.pinned)}|{thread.date}
          </li>
        ))}
      </ul>
      <div data-testid="has-more">{String(hasMoreSidebarChats)}</div>
      <button onClick={() => refreshSidebarChats()}>Refresh chats</button>
      <button onClick={() => refreshSidebarChats({ allPages: true })}>Refresh all</button>
      <button onClick={loadMoreSidebarChats}>Load more</button>
      <button onClick={() => updateSidebarChat("thread-1", { title: "Patched", pinned: true })}>
        Patch
      </button>
      <button onClick={() => removeSidebarChat("thread-1")}>Remove</button>
    </div>
  );
}

function renderConsumer() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    </SWRConfig>,
  );
}

afterEach(() => {
  authState.isLoaded = true;
  authState.userId = "user_a";
  cleanup();
  if (typeof globalThis.fetch === "function" && "mockRestore" in globalThis.fetch) {
    (globalThis.fetch as unknown as { mockRestore: () => void }).mockRestore();
  }
  document.body.innerHTML = "";
});

describe("ChatProvider sidebar chats", () => {
  test("starts loading chats on mount", () => {
    const pendingFetch = mock(async () => await new Promise<Response>(() => {}));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = pendingFetch as unknown as typeof fetch;

    const view = renderConsumer();

    expect(view.getByTestId("loading").textContent).toBe("true");
    expect(pendingFetch).toHaveBeenCalledWith("/api/chats?scope=main");

    globalThis.fetch = originalFetch;
  });

  test("normalizes chat rows into ThreadLink values", async () => {
    const fetchController = createMockFetch([
      {
        body: {
          data: [
            {
              id: "thread-1",
              title: null,
              owner_id: "sb-user",
              created_at: "2026-03-08T00:00:00.000Z",
              updated_at: "2026-03-08T01:00:00.000Z",
            },
          ],
          pinned: [
            {
              id: "thread-2",
              title: "Pinned thread",
              owner_id: "sb-user",
              created_at: "2026-03-08T02:00:00.000Z",
              updated_at: "2026-03-08T03:00:00.000Z",
              pinned: true,
            },
          ],
          nextCursor: null,
        },
      },
    ]);

    const view = renderConsumer();

    await waitFor(() => {
      expect(view.getByTestId("loading").textContent).toBe("false");
    });

    const threadsText = view.getByTestId("threads").textContent ?? "";
    expect(threadsText).toContain("Unknown title|false|2026-03-08T01:00:00.000Z");
    expect(threadsText).toContain("Pinned thread|true|2026-03-08T03:00:00.000Z");

    fetchController.restore();
  });

  test("surfaces an Unauthorized error when the chats fetch returns 401", async () => {
    const fetchController = createMockFetch([
      {
        status: 401,
        body: { error: "Unauthorized" },
      },
    ]);

    const view = renderConsumer();

    await waitFor(() => {
      expect(view.getByTestId("error").textContent).toBe("Unauthorized");
    });

    fetchController.restore();
  });

  test("refreshSidebarChats revalidates the first page", async () => {
    const fetchController = createMockFetch([
      {
        body: {
          data: [
            {
              id: "thread-1",
              title: "First title",
              owner_id: "sb-user",
              created_at: "2026-03-08T00:00:00.000Z",
              updated_at: "2026-03-08T01:00:00.000Z",
              pinned: false,
            },
          ],
        },
      },
      {
        body: {
          data: [
            {
              id: "thread-1",
              title: "Updated title",
              owner_id: "sb-user",
              created_at: "2026-03-08T00:00:00.000Z",
              updated_at: "2026-03-08T04:00:00.000Z",
              pinned: false,
            },
          ],
        },
      },
    ]);

    const view = renderConsumer();

    await waitFor(() => {
      expect(view.getByText(/First title\|false/)).toBeDefined();
    });

    fireEvent.click(view.getByText("Refresh chats"));

    await waitFor(() => {
      expect(view.getByText(/Updated title\|false/)).toBeDefined();
    });

    expect(fetchController.calls).toHaveLength(2);
    fetchController.restore();
  });

  const threadRow = (id: string, title: string, updatedAt: string) => ({
    id,
    title,
    owner_id: "sb-user",
    created_at: updatedAt,
    updated_at: updatedAt,
    pinned: false,
  });

  test("loads older pages with the previous page's cursor", async () => {
    const fetchController = createMockFetch([
      { body: { data: [threadRow("thread-2", "Newer", "2026-03-09T00:00:00.000Z")], pinned: [], nextCursor: "c1" } },
      { body: { data: [threadRow("thread-1", "Older", "2026-03-08T00:00:00.000Z")], nextCursor: null } },
    ]);

    const view = renderConsumer();

    await waitFor(() => {
      expect(view.getByTestId("has-more").textContent).toBe("true");
    });

    fireEvent.click(view.getByText("Load more"));

    await waitFor(() => {
      expect(view.getByText(/Older\|false/)).toBeDefined();
    });

    expect(fetchController.calls.map((call) => String(call[0]))).toEqual([
      "/api/chats?scope=main",
      "/api/chats?scope=main&cursor=c1",
    ]);
    expect(view.getByTestId("has-more").textContent).toBe("false");
    expect(view.getByTestId("threads").textContent).toMatch(/Newer.*Older/);
    fetchController.restore();
  });

  test("patches and removes threads without refetching", async () => {
    const fetchController = createMockFetch([
      {
        body: {
          data: [
            threadRow("thread-1", "Original", "2026-03-08T00:00:00.000Z"),
            threadRow("thread-2", "Other", "2026-03-07T00:00:00.000Z"),
          ],
          pinned: [],
          nextCursor: null,
        },
      },
    ]);

    const view = renderConsumer();

    await waitFor(() => {
      expect(view.getByText(/Original\|false/)).toBeDefined();
    });

    fireEvent.click(view.getByText("Patch"));

    await waitFor(() => {
      expect(view.getByText(/Patched\|true/)).toBeDefined();
    });

    fireEvent.click(view.getByText("Remove"));

    await waitFor(() => {
      expect(view.queryByText(/Patched/)).toBeNull();
    });

    expect(view.getByText(/Other\|false/)).toBeDefined();
    expect(fetchController.calls).toHaveLength(1);
    fetchController.restore();
  });

  test("first-page refresh leaves loaded older pages cached; allPages refetches them", async () => {
    const page1 = { data: [threadRow("thread-2", "Newer", "2026-03-09T00:00:00.000Z")], pinned: [], nextCursor: "c1" };
    const page2 = { data: [threadRow("thread-1", "Older", "2026-03-08T00:00:00.000Z")], nextCursor: null };
    const fetchController = createMockFetch([], {
      route: (url) => ({ body: url.includes("cursor=") ? page2 : page1 }),
    });

    const view = renderConsumer();

    await waitFor(() => {
      expect(view.getByTestId("has-more").textContent).toBe("true");
    });
    fireEvent.click(view.getByText("Load more"));
    await waitFor(() => {
      expect(view.getByText(/Older\|false/)).toBeDefined();
    });

    fireEvent.click(view.getByText("Refresh chats"));
    await waitFor(() => {
      expect(fetchController.calls).toHaveLength(3);
    });
    expect(String(fetchController.calls[2]?.[0])).toBe("/api/chats?scope=main");

    fireEvent.click(view.getByText("Refresh all"));
    await waitFor(() => {
      expect(fetchController.calls).toHaveLength(5);
    });
    expect(fetchController.calls.slice(3).map((call) => String(call[0]))).toEqual([
      "/api/chats?scope=main",
      "/api/chats?scope=main&cursor=c1",
    ]);
    fetchController.restore();
  });

  test("window focus refetches the first page at most once a minute", async () => {
    const page = { data: [threadRow("thread-1", "Only", "2026-03-08T00:00:00.000Z")], pinned: [], nextCursor: null };
    const fetchController = createMockFetch([], { route: () => ({ body: page }) });
    const start = Date.now();

    try {
      const view = renderConsumer();

      await waitFor(() => {
        expect(view.getByText(/Only\|false/)).toBeDefined();
      });

      window.dispatchEvent(new Event("focus"));
      expect(fetchController.calls).toHaveLength(1);

      setSystemTime(new Date(start + 61_000));
      window.dispatchEvent(new Event("focus"));
      await waitFor(() => {
        expect(fetchController.calls).toHaveLength(2);
      });

      window.dispatchEvent(new Event("focus"));
      expect(fetchController.calls).toHaveLength(2);
    } finally {
      setSystemTime();
      fetchController.restore();
    }
  });

  test("does not fetch until Clerk resolves a signed-in user, and shows loading meanwhile", async () => {
    const pendingFetch = mock(async () => await new Promise<Response>(() => {}));
    const originalFetch = globalThis.fetch;

    globalThis.fetch = pendingFetch as unknown as typeof fetch;
    authState.isLoaded = false;
    authState.userId = null;

    try {
      const view = renderConsumer();

      expect(view.getByTestId("loading").textContent).toBe("true");
      expect(pendingFetch).not.toHaveBeenCalled();

      authState.isLoaded = true;
      view.rerender(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <ChatProvider>
            <TestConsumer />
          </ChatProvider>
        </SWRConfig>,
      );

      expect(view.getByTestId("loading").textContent).toBe("false");
      expect(pendingFetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("fetches as soon as the user signs in, without waiting on a retry", async () => {
    const page = { data: [threadRow("thread-1", "Mine", "2026-03-08T00:00:00.000Z")], pinned: [], nextCursor: null };
    const fetchController = createMockFetch([], { route: () => ({ body: page }) });

    authState.userId = null;

    try {
      // A fresh element each time; React skips re-rendering an identical one.
      const cache = new Map();
      const tree = () => (
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
          <ChatProvider>
            <TestConsumer />
          </ChatProvider>
        </SWRConfig>
      );
      const view = render(tree());

      expect(fetchController.calls).toHaveLength(0);

      authState.userId = "user_a";
      view.rerender(tree());

      await waitFor(() => {
        expect(view.getByText(/Mine\|false/)).toBeDefined();
      });
      expect(fetchController.calls).toHaveLength(1);
    } finally {
      fetchController.restore();
    }
  });

  test("keeps each user's threads in a separate cache", async () => {
    const fetchController = createMockFetch([
      { body: { data: [threadRow("a-1", "Alice thread", "2026-03-08T00:00:00.000Z")], pinned: [], nextCursor: null } },
      { body: { data: [threadRow("b-1", "Bob thread", "2026-03-08T00:00:00.000Z")], pinned: [], nextCursor: null } },
    ]);

    try {
      // A fresh element each time; React skips re-rendering an identical one.
      const cache = new Map();
      const tree = () => (
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
          <ChatProvider>
            <TestConsumer />
          </ChatProvider>
        </SWRConfig>
      );
      const view = render(tree());

      await waitFor(() => {
        expect(view.getByText(/Alice thread/)).toBeDefined();
      });

      authState.userId = "user_b";
      view.rerender(tree());

      expect(view.queryByText(/Alice thread/)).toBeNull();
      await waitFor(() => {
        expect(view.getByText(/Bob thread/)).toBeDefined();
      });
    } finally {
      fetchController.restore();
    }
  });

  test("does not retry a 401", async () => {
    const fetchController = createMockFetch([], { route: () => ({ status: 401, body: { error: "Unauthorized" } }) });

    try {
      const view = renderConsumer();

      await waitFor(() => {
        expect(view.getByTestId("error").textContent).toBe("Unauthorized");
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(fetchController.calls).toHaveLength(1);
    } finally {
      fetchController.restore();
    }
  });
});

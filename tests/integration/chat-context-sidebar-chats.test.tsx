import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

import { createMockFetch } from "../helpers/mock-fetch";
import { render } from "../helpers/render";

import {
  ChatProvider,
  useSharedChatContext,
} from "@/lib/context/chat-context";

function TestConsumer() {
  const {
    sidebarChats,
    isSidebarChatsLoading,
    sidebarChatsError,
    refreshSidebarChats,
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
      <button onClick={refreshSidebarChats}>Refresh chats</button>
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
    expect(pendingFetch).toHaveBeenCalledWith("/api/chats");

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
            {
              id: "thread-2",
              title: "Pinned thread",
              owner_id: "sb-user",
              created_at: "2026-03-08T02:00:00.000Z",
              updated_at: "2026-03-08T03:00:00.000Z",
              pinned: true,
            },
          ],
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

  test("refreshSidebarChats revalidates the SWR key", async () => {
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
});

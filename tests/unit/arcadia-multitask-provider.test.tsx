import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

import {
  ArcadiaMultitaskProvider,
  useArcadiaMultitask,
} from "@/app/sandbox/arcadia/_components/multitask-provider";
import { StrictMode } from "react";
import { useBackgroundThreadMessages } from "@/hooks/use-background-thread-messages";
import {
  MULTITASK_VIEW_POLL_IDLE_MS,
  MULTITASK_VIEW_POLL_MS,
} from "@/lib/arcadia/multitask/layout-mode";
import {
  multitaskViewStorageKey,
  writeMultitaskViewLocal,
} from "@/lib/arcadia/multitask/view-sync";

const THREAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function View() {
  const { layoutMode, toggleMultitaskView, hasSubagentThreads } = useArcadiaMultitask();

  useBackgroundThreadMessages({
    threadId: THREAD_ID,
    enabled: hasSubagentThreads,
    status: "ready",
    setMessages: () => {},
  });

  return <button onClick={() => void toggleMultitaskView()}>{layoutMode}</button>;
}

function App({ initialHasSubagentThreads }: { initialHasSubagentThreads?: boolean } = {}) {
  return (
    <ArcadiaMultitaskProvider
      threadId={THREAD_ID}
      initialHasSubagentThreads={initialHasSubagentThreads}
    >
      <View />
    </ArcadiaMultitaskProvider>
  );
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function viewResponse(enabled: boolean) {
  return Response.json({ enabled, activeStreamId: null });
}

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");

function poll() {
  window.dispatchEvent(new Event("focus"));
}

beforeEach(() => {
  window.localStorage.removeItem(multitaskViewStorageKey(THREAD_ID));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => viewResponse(false));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
  else Reflect.deleteProperty(document, "visibilityState");
  window.localStorage.removeItem(multitaskViewStorageKey(THREAD_ID));
});

describe("Arcadia multitask view", () => {
  test("a poll started before opening cannot close the dashboard while the toggle is saved", async () => {
    const oldPoll = deferredResponse();
    const patch = deferredResponse();
    let reads = 0;

    fetchSpy.mockImplementation(async (url, options) => {
      if (!String(url).endsWith("/multitask-view")) return Response.json({ subagents: [] });
      if (options?.method === "PATCH") return patch.promise;
      reads += 1;

      return reads === 1 ? oldPoll.promise : viewResponse(false);
    });

    const app = render(<App />);

    fireEvent.click(app.getByRole("button", { name: "overlay" }));
    await waitFor(() => expect(app.getByRole("button").textContent).toBe("dashboard"));
    await act(async () => {
      oldPoll.resolve(viewResponse(false));
    });
    expect(app.getByRole("button").textContent).toBe("dashboard");

    await act(async () => {
      patch.resolve(viewResponse(true));
    });
    expect(app.getByRole("button").textContent).toBe("dashboard");
  });

  test("a pending toggle suppresses background reads until the save finishes", async () => {
    const patch = deferredResponse();
    let reads = 0;

    fetchSpy.mockImplementation(async (url, options) => {
      if (!String(url).endsWith("/multitask-view")) return Response.json({ subagents: [] });
      if (options?.method === "PATCH") return patch.promise;
      reads += 1;

      return viewResponse(false);
    });

    const app = render(<App />);

    await act(async () => {});
    fireEvent.click(app.getByRole("button", { name: "overlay" }));
    await waitFor(() => expect(app.getByRole("button").textContent).toBe("dashboard"));
    const readsBeforePoll = reads;

    act(() => poll());
    expect(reads).toBe(readsBeforePoll);
    await act(async () => {
      patch.resolve(viewResponse(true));
    });
    expect(app.getByRole("button").textContent).toBe("dashboard");
  });

  test("a later server poll still syncs changes made on another device", async () => {
    let serverEnabled = false;

    fetchSpy.mockImplementation(async (url, options) => {
      if (!String(url).endsWith("/multitask-view")) return Response.json({ subagents: [] });
      if (options?.method === "PATCH") serverEnabled = JSON.parse(String(options.body)).enabled;

      return viewResponse(serverEnabled);
    });

    const app = render(<App />);

    fireEvent.click(app.getByRole("button", { name: "overlay" }));
    await waitFor(() => expect(app.getByRole("button").textContent).toBe("dashboard"));
    serverEnabled = false;
    await act(async () => poll());
    expect(app.getByRole("button").textContent).toBe("overlay");
  });

  test("a cached dashboard hydrates without replacing the server-rendered chat", async () => {
    const container = document.createElement("div");
    const errors: unknown[] = [];

    container.innerHTML = renderToString(<App />);
    document.body.appendChild(container);
    const serverButton = container.querySelector("button");

    writeMultitaskViewLocal(THREAD_ID, true);
    fetchSpy.mockImplementation(async (url) =>
      String(url).endsWith("/multitask-view")
        ? viewResponse(true)
        : Response.json({ subagents: [] })
    );

    let root!: ReturnType<typeof hydrateRoot>;

    try {
      await act(async () => {
        root = hydrateRoot(container, <App />, {
          onRecoverableError: (error) => errors.push(error),
        });
      });
      expect(errors).toHaveLength(0);
      expect(container.querySelector("button")).toBe(serverButton);
      expect(container.querySelector("button")?.textContent).toBe("dashboard");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  test("a server-seeded ordinary chat makes no Multiagent mount requests in Strict Mode", async () => {
    await act(async () => {
      render(
        <StrictMode>
          <App initialHasSubagentThreads={false} />
        </StrictMode>
      );
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("persisted workers keep board and message reads enabled with the dashboard off", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (String(url).endsWith("/subagents")) {
        return Response.json({
          subagents: [
            {
              agentId: "agent-researcher",
              threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              status: "working",
            },
          ],
        });
      }

      return Response.json({ messages: [] });
    });
    const app = render(<App initialHasSubagentThreads />);

    await act(async () => {});
    const urls = fetchSpy.mock.calls.map(([url]) => String(url));

    expect(urls.filter((url) => url.endsWith("/subagents"))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith("/messages"))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith("/multitask-view"))).toHaveLength(0);
    expect(app.getByRole("button").textContent).toBe("overlay");
  });

  test("cross-device worker discovery starts the board and message reads", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (String(url).endsWith("/multitask-view")) {
        return Response.json({ enabled: false, hasSubagentThreads: true });
      }
      if (String(url).endsWith("/subagents")) {
        return Response.json({
          subagents: [
            {
              agentId: "agent-researcher",
              threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              status: "working",
            },
          ],
        });
      }

      return Response.json({ messages: [] });
    });
    render(<App initialHasSubagentThreads={false} />);

    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => poll());
    const urls = fetchSpy.mock.calls.map(([url]) => String(url));

    expect(urls.filter((url) => url.endsWith("/subagents"))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith("/messages"))).toHaveLength(1);
  });

  test("unmount aborts pending reads and late responses cannot start more work", async () => {
    const pending = deferredResponse();
    const signals: AbortSignal[] = [];

    fetchSpy.mockImplementation(async (_url, options) => {
      signals.push(options?.signal as AbortSignal);

      return pending.promise;
    });
    const app = render(<App />);
    const reads = fetchSpy.mock.calls.length;

    app.unmount();
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await act(async () => {
      pending.resolve(Response.json({ enabled: true, subagents: [] }));
      poll();
    });
    expect(fetchSpy.mock.calls.length).toBe(reads);
  });

  test("idle discovery is slower, active discovery is fast, and hidden tabs skip reads", async () => {
    const timers = spyOn(window, "setTimeout");

    try {
      fetchSpy.mockImplementation(async (url) =>
        String(url).endsWith("/multitask-view")
          ? Response.json({ enabled: true, hasSubagentThreads: false })
          : Response.json({ subagents: [] })
      );
      render(<App initialHasSubagentThreads={false} />);
      expect(timers.mock.calls.some(([, ms]) => ms === MULTITASK_VIEW_POLL_IDLE_MS)).toBe(true);
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      await act(async () => poll());
      expect(fetchSpy).not.toHaveBeenCalled();
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      await act(async () => document.dispatchEvent(new Event("visibilitychange")));
      expect(timers.mock.calls.some(([, ms]) => ms === MULTITASK_VIEW_POLL_MS)).toBe(true);
    } finally {
      timers.mockRestore();
    }
  });
});

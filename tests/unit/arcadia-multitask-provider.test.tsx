import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

import {
  ArcadiaMultitaskProvider,
  useArcadiaMultitask,
} from "@/app/sandbox/arcadia/_components/multitask-provider";
import { MULTITASK_VIEW_POLL_MS } from "@/lib/arcadia/multitask/layout-mode";
import {
  multitaskViewStorageKey,
  writeMultitaskViewLocal,
} from "@/lib/arcadia/multitask/view-sync";

const THREAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function View() {
  const { layoutMode, toggleMultitaskView } = useArcadiaMultitask();

  return <button onClick={() => void toggleMultitaskView()}>{layoutMode}</button>;
}

function App() {
  return (
    <ArcadiaMultitaskProvider threadId={THREAD_ID}>
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
let intervalSpy: ReturnType<typeof spyOn<typeof window, "setInterval">>;
let poll: () => void;

beforeEach(() => {
  window.localStorage.removeItem(multitaskViewStorageKey(THREAD_ID));
  intervalSpy = spyOn(window, "setInterval").mockImplementation((handler, ms) => {
    if (ms === MULTITASK_VIEW_POLL_MS) poll = handler as () => void;

    return 1;
  });
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => viewResponse(false));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  intervalSpy.mockRestore();
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

  test("a poll during a pending toggle cannot restore the old view after the save finishes", async () => {
    const patch = deferredResponse();
    const oldPoll = deferredResponse();
    let reads = 0;

    fetchSpy.mockImplementation(async (url, options) => {
      if (!String(url).endsWith("/multitask-view")) return Response.json({ subagents: [] });
      if (options?.method === "PATCH") return patch.promise;
      reads += 1;

      return reads <= 2 ? viewResponse(false) : oldPoll.promise;
    });

    const app = render(<App />);

    await act(async () => {});
    fireEvent.click(app.getByRole("button", { name: "overlay" }));
    await waitFor(() => expect(app.getByRole("button").textContent).toBe("dashboard"));
    act(() => poll());
    await act(async () => {
      patch.resolve(viewResponse(true));
    });
    await act(async () => {
      oldPoll.resolve(viewResponse(false));
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
});

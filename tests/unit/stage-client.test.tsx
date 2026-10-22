import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { useStage } from "@/components/stage/use-stage";
import { emptyStageState, type StageState } from "@/lib/stage/schema";

const originalFetch = globalThis.fetch;
let stage: ReturnType<typeof useStage>;

function Harness() {
  stage = useStage();

  return <span>{stage.state?.revision ?? "loading"}</span>;
}

function response(state: StageState) {
  return Response.json({ state });
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("stage client concurrency", () => {
  test("rejects duplicate sends before React publishes busy state", async () => {
    const initial = emptyStageState();
    let resolveSend!: (value: Response) => void;
    const requests: RequestInit[] = [];

    globalThis.fetch = mock(async (_url, init) => {
      if (init?.method === "POST") {
        requests.push(init);

        return new Promise<Response>((resolve) => { resolveSend = resolve; });
      }

      return response(initial);
    }) as typeof fetch;
    render(<Harness />);
    await waitFor(() => expect(stage.loading).toBe(false));
    await act(async () => {
      const first = stage.send("Make room for a note");
      const second = stage.send("Make room for a note");

      expect(await second).toBe(false);
      resolveSend(response({ ...initial, revision: 1 }));
      expect(await first).toBe(true);
    });
    expect(requests).toHaveLength(1);
  });

  test("a delayed read cannot replace a newer saved revision", async () => {
    const initial = emptyStageState();
    let reads = 0;
    let resolveOldRead!: (value: Response) => void;

    globalThis.fetch = mock(async (_url, init) => {
      if (init?.method === "PATCH") return response({ ...initial, revision: 2 });
      reads++;
      if (reads === 1) return response(initial);

      return new Promise<Response>((resolve) => { resolveOldRead = resolve; });
    }) as typeof fetch;
    render(<Harness />);
    await waitFor(() => expect(stage.loading).toBe(false));
    await act(async () => {
      const read = stage.refresh();

      await stage.mutate([{ type: "remove", id: "11111111-1111-4111-8111-111111111111" }]);
      resolveOldRead(response({ ...initial, revision: 1 }));
      await read;
    });
    expect(stage.state?.revision).toBe(2);
  });

  test("retrying a failed send reuses its idempotency key", async () => {
    const initial = emptyStageState();
    const ids: string[] = [];

    globalThis.fetch = mock(async (_url, init) => {
      if (init?.method === "POST") {
        ids.push(JSON.parse(String(init.body)).requestId);

        return ids.length === 1 ? Response.json({ error: "Connection lost" }, { status: 503 }) : response({ ...initial, revision: 1 });
      }

      return response(initial);
    }) as typeof fetch;
    render(<Harness />);
    await waitFor(() => expect(stage.loading).toBe(false));
    await act(async () => { expect(await stage.send("An idea")).toBe(false); });
    await act(async () => { expect(await stage.send("An idea")).toBe(true); });
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });
});

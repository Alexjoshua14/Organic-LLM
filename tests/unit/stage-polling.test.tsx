import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { useStage } from "@/components/stage/use-stage";
import { emptyStageState, type StageState } from "@/lib/stage/schema";

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

test("an unchanged revision keeps the state on screen, and reads ask only for changes", async () => {
  const urls: string[] = [];
  let server: StageState = { ...emptyStageState(), revision: 3 };

  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return Response.json({ state: { ...server } });
  }) as typeof fetch;
  const { result } = renderHook(() => useStage());

  await waitFor(() => expect(result.current.state?.revision).toBe(3));
  const shown = result.current.state;

  // The same revision, even as a new object, is not a new state.
  await act(() => result.current.refresh());
  expect(result.current.state).toBe(shown);
  expect(urls.at(-1)).toBe("/api/stage?since=3");

  server = { ...server, revision: 4 };
  await act(() => result.current.refresh());
  expect(result.current.state?.revision).toBe(4);
});

test("a failed background read stays quiet; an explicit retry shows the error", async () => {
  let fail = false;

  globalThis.fetch = (async () =>
    fail
      ? Response.json({ error: "Stage request failed" }, { status: 500 })
      : Response.json({ state: { ...emptyStageState(), revision: 1 } })) as typeof fetch;
  const { result } = renderHook(() => useStage());

  await waitFor(() => expect(result.current.state?.revision).toBe(1));
  fail = true;
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(result.current.error).toBeNull();
  await act(() => result.current.refresh());
  expect(result.current.error).toBe("Stage request failed");
});

test("a background read that finds the session ended says so", async () => {
  let status = 200;

  globalThis.fetch = (async () =>
    status === 200
      ? Response.json({ state: { ...emptyStageState(), revision: 1 } })
      : Response.json({ error: "Unauthorized" }, { status })) as typeof fetch;
  const { result } = renderHook(() => useStage());

  await waitFor(() => expect(result.current.state?.revision).toBe(1));
  status = 401;
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(result.current.error).toBe("Sign in to open your stage.");
});


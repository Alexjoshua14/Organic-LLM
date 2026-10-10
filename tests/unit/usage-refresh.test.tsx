import type { UsageApiPayload } from "@/lib/usage/types";

import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import * as clerk from "@clerk/nextjs";

import { UsageOverlay } from "@/components/usage/usage-overlay";
import { USAGE_REFRESH_MS } from "@/components/usage/usage-refresh-progress";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

const totals = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
  costUsd: 0,
  callCount: 0,
};
const payload: UsageApiPayload = {
  range: { start: "2026-10-01", end: "2026-10-10", preset: "30d" },
  billingCycle: { start: "2026-10-01", end: "2026-11-01" },
  totals,
  billingCycleTotals: totals,
  daily: [],
  byModel: [],
  planAllotments: [],
  pricingAsOf: "2026-10-10",
};

let clock: number;
let visibility: DocumentVisibilityState;
let visibilityDescriptor: PropertyDescriptor | undefined;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
let clockSpy: ReturnType<typeof spyOn<typeof Date, "now">>;
let restoreAuth: () => void;

beforeEach(() => {
  jest.useFakeTimers();
  clock = Date.parse("2026-10-10T12:00:00Z");
  clockSpy = spyOn(Date, "now").mockImplementation(() => clock);
  visibility = "visible";
  visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  restoreAuth = mockModulePreservingReal("@clerk/nextjs", clerk, {
    useAuth: (() => ({ isSignedIn: true })) as never,
  });
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(payload));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  clockSpy.mockRestore();
  restoreAuth();
  if (visibilityDescriptor)
    Object.defineProperty(document, "visibilityState", visibilityDescriptor);
  else Reflect.deleteProperty(document, "visibilityState");
  jest.useRealTimers();
});

async function advance(ms: number) {
  await act(async () => {
    clock += ms;
    jest.advanceTimersByTime(ms);
  });
}

async function openUsage() {
  const view = render(<UsageOverlay />);

  await act(async () => fireEvent.click(view.getByRole("button", { name: "Usage and cost" })));

  return view;
}

describe("usage refresh timing", () => {
  test("the compact header's indicator reaches the actual next refresh and resets", async () => {
    const view = await openUsage();

    expect(view.getByRole("heading", { name: "Organic • Usage" })).toBeTruthy();
    expect(view.queryByRole("heading", { name: "Usage", exact: true })).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(view.getByRole("progressbar").getAttribute("aria-valuetext")).toBe(
      "Next refresh in 10 seconds"
    );
    await advance(USAGE_REFRESH_MS - 5_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  test("range and focus refreshes reset the deadline; a pending request never overlaps", async () => {
    const view = await openUsage();

    await advance(10_000);
    await act(async () => fireEvent.click(view.getByRole("button", { name: "7 days" })));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("/api/usage?range=7d");
    await advance(5_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    let resolve!: (response: Response) => void;
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        })
    );
    await advance(USAGE_REFRESH_MS);
    expect(view.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Refreshing usage");
    await advance(USAGE_REFRESH_MS * 2);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    await act(async () => resolve(Response.json(payload)));
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    await advance(USAGE_REFRESH_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    await act(async () => resolve(Response.json(payload)));
  });

  test("hidden and closed panels stop polling; returning to a visible tab refreshes immediately", async () => {
    const view = await openUsage();

    visibility = "hidden";
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await advance(USAGE_REFRESH_MS * 2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    visibility = "visible";
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Close" })));
    await advance(USAGE_REFRESH_MS * 2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

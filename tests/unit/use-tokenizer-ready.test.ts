import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useTokenizerReady } from "@/hooks/use-tokenizer-ready";
import { approximateDraftTokens, estimateDraftTokens } from "@/lib/chat/context-budget";
import { ensureDom } from "../helpers/render";

ensureDom();

const idleQueue: IdleRequestCallback[] = [];

afterEach(() => {
  cleanup();
  idleQueue.length = 0;
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
});

function installManualIdle() {
  window.requestIdleCallback = ((callback: IdleRequestCallback) =>
    idleQueue.push(callback)) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = () => {};
}

describe("useTokenizerReady", () => {
  test("does nothing until a count needs it", () => {
    installManualIdle();

    const { result } = renderHook(() => useTokenizerReady(false));

    expect(result.current).toBe(false);
    expect(idleQueue.length).toBe(0);
  });

  test("once needed, is ready after the browser is idle", () => {
    installManualIdle();

    const { result } = renderHook(() => useTokenizerReady(true));

    expect(idleQueue.length).toBe(1);

    act(() => {
      for (const callback of idleQueue.splice(0)) {
        callback({ didTimeout: false, timeRemaining: () => 0 });
      }
    });

    expect(result.current).toBe(true);
  });
});

describe("approximateDraftTokens", () => {
  test("stays near the tokenizer's count for prose", () => {
    const draft = "Could you compare the two approaches and say which one ships sooner?";
    const exact = estimateDraftTokens(draft);

    expect(approximateDraftTokens("   ")).toBe(0);
    expect(Math.abs(approximateDraftTokens(draft) - exact) / exact).toBeLessThan(0.5);
  });
});

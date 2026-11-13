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

describe("useTokenizerReady", () => {
  test("is false until the browser is idle, then true", () => {
    window.requestIdleCallback = ((callback: IdleRequestCallback) =>
      idleQueue.push(callback)) as typeof window.requestIdleCallback;
    window.cancelIdleCallback = () => {};

    const { result } = renderHook(() => useTokenizerReady());

    expect(result.current).toBe(false);

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

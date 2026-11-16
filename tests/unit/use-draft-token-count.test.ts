import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useDraftTokenCount } from "@/hooks/use-draft-token-count";
import { approximateDraftTokens, type TextTokenCounter } from "@/lib/chat/context-budget";
import { estimateDraftTokens } from "@/lib/chat/token-count";
import { estimateTokenCountSync } from "@/lib/chat/tokenizer";
import { ensureDom } from "../helpers/render";

ensureDom();

afterEach(() => {
  cleanup();
});

/** Answers only when the test releases it, so the pending state is observable. */
function deferredCounter() {
  const pending: Array<() => void> = [];
  const counter: TextTokenCounter = (texts) =>
    new Promise((resolve) => pending.push(() => resolve(texts.map(estimateTokenCountSync))));

  return {
    counter,
    release: () =>
      act(async () => {
        for (const resolve of pending.splice(0)) resolve();
      }),
  };
}

describe("useDraftTokenCount", () => {
  test("approximates until the exact count arrives", async () => {
    const draft = "Could you compare the two approaches and say which one ships sooner?";
    const { counter, release } = deferredCounter();
    const { result } = renderHook(() => useDraftTokenCount(draft, counter));

    expect(result.current).toBe(approximateDraftTokens(draft));

    await release();

    expect(result.current).toBe(estimateDraftTokens(draft));
  });

  test("a blank draft is zero and drops the last count", async () => {
    const { counter, release } = deferredCounter();
    const { result, rerender } = renderHook(({ text }) => useDraftTokenCount(text, counter), {
      initialProps: { text: "A first draft that gets counted" },
    });

    await release();
    rerender({ text: "   " });
    expect(result.current).toBe(0);

    rerender({ text: "Hi" });
    expect(result.current).toBe(approximateDraftTokens("Hi"));
  });
});

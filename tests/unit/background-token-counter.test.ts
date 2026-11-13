import { afterEach, describe, expect, test } from "bun:test";

import { countInIdleSlices, countTokensInBackground } from "@/lib/chat/background-token-counter";
import { estimateTokenCountSync } from "@/lib/chat/tokenizer";
import { ensureDom } from "../helpers/render";

ensureDom();

const idleQueue: IdleRequestCallback[] = [];

afterEach(() => {
  idleQueue.length = 0;
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
});

describe("countInIdleSlices", () => {
  test("counts while the browser is idle and resolves in order", async () => {
    window.requestIdleCallback = ((callback: IdleRequestCallback) =>
      idleQueue.push(callback)) as typeof window.requestIdleCallback;
    window.cancelIdleCallback = () => {};
    const counted: string[] = [];
    const result = countInIdleSlices(["a", "bb", "ccc"], (text) => {
      counted.push(text);

      return text.length;
    });

    expect(counted).toEqual([]);

    // No idle time left: one text per slice.
    for (let slice = 0; slice < 3; slice++) {
      idleQueue.shift()?.({ didTimeout: false, timeRemaining: () => 0 });
      expect(counted.length).toBe(slice + 1);
    }

    expect(await result).toEqual([1, 2, 3]);
  });
});

describe("countTokensInBackground", () => {
  test("loads the tokenizer on demand and returns exact counts", async () => {
    const texts = ["user: Hello there", "", "assistant: A longer reply with 🚀 emoji."];

    expect(await countTokensInBackground(texts)).toEqual(texts.map(estimateTokenCountSync));
    expect(await countTokensInBackground([])).toEqual([]);
  });
});

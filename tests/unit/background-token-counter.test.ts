import { afterEach, describe, expect, test } from "bun:test";

import type { TextTokenCounter } from "@/lib/chat/context-budget";
import type { TokenWorkerRequest } from "@/lib/chat/tokenizer.worker";

import {
  countInIdleSlices,
  countOnMainThread,
  createBackgroundTokenCounter,
} from "@/lib/chat/background-token-counter";
import { estimateTokenCountSync } from "@/lib/chat/tokenizer";
import { ensureDom } from "../helpers/render";

ensureDom();

const idleQueue: IdleRequestCallback[] = [];

afterEach(() => {
  idleQueue.length = 0;
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
});

/** Stands in for the token worker: records requests and answers or fails on demand. */
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  posted: TokenWorkerRequest[] = [];
  terminated = false;

  postMessage(message: TokenWorkerRequest) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  answer(request: TokenWorkerRequest) {
    this.onmessage?.({
      data: { id: request.id, counts: request.texts.map(estimateTokenCountSync) },
    } as MessageEvent);
  }

  fail() {
    this.onerror?.(new Event("error"));
  }
}

function counterWith(worker: FakeWorker | (() => never), firstAnswerTimeoutMs?: number) {
  const fallbackCalls: string[][] = [];
  const fallback: TextTokenCounter = async (texts) => {
    fallbackCalls.push(texts);

    return texts.map(() => -1);
  };
  const counter = createBackgroundTokenCounter({
    createWorker: typeof worker === "function" ? worker : () => worker as unknown as Worker,
    fallback,
    firstAnswerTimeoutMs,
  });

  return { counter, fallbackCalls };
}

describe("createBackgroundTokenCounter", () => {
  test("counts through the worker, matching answers to requests by id", async () => {
    const worker = new FakeWorker();
    const { counter, fallbackCalls } = counterWith(worker);
    const first = counter.count(["user: first"]);
    const second = counter.count(["user: second request", "assistant: reply"]);

    expect(worker.posted.map((request) => request.texts.length)).toEqual([1, 2]);

    // Answers may arrive in any order.
    worker.answer(worker.posted[1]!);
    worker.answer(worker.posted[0]!);

    expect(await first).toEqual([estimateTokenCountSync("user: first")]);
    expect(await second).toEqual(
      ["user: second request", "assistant: reply"].map(estimateTokenCountSync)
    );
    expect(fallbackCalls).toEqual([]);
    expect(await counter.count([])).toEqual([]);
  });

  test("a worker error sends pending and later counts to the fallback", async () => {
    const worker = new FakeWorker();
    const { counter, fallbackCalls } = counterWith(worker);
    const pending = counter.count(["user: waiting"]);

    worker.fail();

    expect(await pending).toEqual([-1]);
    expect(worker.terminated).toBe(true);
    expect(await counter.count(["user: later"])).toEqual([-1]);
    expect(fallbackCalls).toEqual([["user: waiting"], ["user: later"]]);
  });

  test("a worker that never answers falls back after the first-answer timeout", async () => {
    const worker = new FakeWorker();
    const { counter, fallbackCalls } = counterWith(worker, 20);
    const pending = counter.count(["user: silence"]);

    expect(await pending).toEqual([-1]);
    expect(worker.terminated).toBe(true);
    expect(fallbackCalls).toEqual([["user: silence"]]);
  });

  test("a worker that can't start falls back", async () => {
    const { counter, fallbackCalls } = counterWith(() => {
      throw new Error("blocked");
    });

    expect(await counter.count(["user: no worker"])).toEqual([-1]);
    expect(fallbackCalls).toEqual([["user: no worker"]]);
  });

  test("the real worker counts exactly", async () => {
    const counter = createBackgroundTokenCounter({
      fallback: () => Promise.reject(new Error("fell back instead of using the worker")),
    });
    const texts = ["user: Hello there", "", "assistant: A longer reply with 🚀 emoji."];

    try {
      expect(await counter.count(texts)).toEqual(texts.map(estimateTokenCountSync));
    } finally {
      counter.dispose();
    }
  });
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

describe("countOnMainThread", () => {
  test("loads the tokenizer on demand and returns exact counts", async () => {
    const texts = ["user: Hello there", "", "assistant: A longer reply with 🚀 emoji."];

    expect(await countOnMainThread(texts)).toEqual(texts.map(estimateTokenCountSync));
    expect(await countOnMainThread([])).toEqual([]);
  });
});

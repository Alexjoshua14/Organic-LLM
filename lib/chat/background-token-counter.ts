import type { TextTokenCounter } from "@/lib/chat/context-budget";
import type { TokenWorkerRequest, TokenWorkerResponse } from "@/lib/chat/tokenizer.worker";

import { approximateTokenCount } from "@/lib/chat/approximate-token-count";
import { runInIdleSlices } from "@/lib/idle-work";

/**
 * Client token counting that stays out of the initial bundle and off the main thread. The
 * tokenizer (`lib/chat/tokenizer`, 2.3 MB of ranks) loads in a Web Worker on the first count.
 * If the worker can't start, errors, or never answers, counting falls back to loading the
 * tokenizer with a dynamic import and counting in idle slices; if that fails too, counts are
 * approximated. Counting never rejects.
 */

/**
 * How long the worker may take to answer its first request, which includes downloading the
 * tokenizer (about 1.1 MB gzipped) and building it, before counting falls back. Generous, since
 * the fallback downloads the same tokenizer.
 */
export const TOKEN_WORKER_FIRST_ANSWER_TIMEOUT_MS = 15_000;

type Tokenizer = { estimateTokenCountSync: (text: string) => number };

let mainThreadTokenizer: Promise<Tokenizer | null> | null = null;

function loadMainThreadTokenizer(): Promise<Tokenizer | null> {
  mainThreadTokenizer ??= import("@/lib/chat/tokenizer").catch(() => null);

  return mainThreadTokenizer;
}

/** Counts `texts` in idle slices with `count`, resolving with every count in order. */
export function countInIdleSlices(
  texts: readonly string[],
  count: (text: string) => number
): Promise<number[]> {
  return new Promise((resolve) => {
    const counts: number[] = [];

    runInIdleSlices((hasTimeLeft) => {
      while (counts.length < texts.length && hasTimeLeft()) {
        counts.push(count(texts[counts.length]!));
      }

      if (counts.length < texts.length) return false;

      resolve(counts);

      return true;
    });
  });
}

/** The fallback: the tokenizer through a dynamic import, counted in idle slices. */
export const countOnMainThread: TextTokenCounter = async (texts) => {
  if (texts.length === 0) return [];

  const loaded = await loadMainThreadTokenizer();

  return countInIdleSlices(texts, loaded?.estimateTokenCountSync ?? approximateTokenCount);
};

/** Bundlers find the worker only in this exact shape: an inline `new URL` with a literal path. */
function startTokenWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;

  return new Worker(new URL("./tokenizer.worker.ts", import.meta.url), { type: "module" });
}

export type BackgroundTokenCounter = {
  count: TextTokenCounter;
  /** Stops the worker; pending and later counts use the fallback. */
  dispose: () => void;
};

export function createBackgroundTokenCounter(
  options: {
    createWorker?: () => Worker | null;
    fallback?: TextTokenCounter;
    firstAnswerTimeoutMs?: number;
  } = {}
): BackgroundTokenCounter {
  const {
    createWorker = startTokenWorker,
    fallback = countOnMainThread,
    firstAnswerTimeoutMs = TOKEN_WORKER_FIRST_ANSWER_TIMEOUT_MS,
  } = options;
  const pending = new Map<number, { texts: string[]; resolve: (counts: number[]) => void }>();
  let worker: Worker | null = null;
  let failed = false;
  let answered = false;
  let firstAnswerTimer: ReturnType<typeof setTimeout> | undefined;
  let nextId = 1;

  const fallBack = () => {
    failed = true;
    clearTimeout(firstAnswerTimer);
    worker?.terminate();
    worker = null;

    const waiting = [...pending.values()];

    pending.clear();
    for (const request of waiting) void fallback(request.texts).then(request.resolve);
  };

  const ensureWorker = (): Worker | null => {
    if (failed || worker) return worker;

    try {
      worker = createWorker();
    } catch {
      worker = null;
    }

    if (!worker) {
      failed = true;

      return null;
    }

    worker.onmessage = (event: MessageEvent<TokenWorkerResponse>) => {
      const request = pending.get(event.data.id);

      if (!request) return;

      pending.delete(event.data.id);
      answered = true;
      clearTimeout(firstAnswerTimer);
      request.resolve(event.data.counts);
    };
    worker.onerror = fallBack;
    worker.onmessageerror = fallBack;
    firstAnswerTimer = setTimeout(() => {
      if (!answered) fallBack();
    }, firstAnswerTimeoutMs);

    return worker;
  };

  const count: TextTokenCounter = (texts) => {
    if (texts.length === 0) return Promise.resolve([]);

    const active = ensureWorker();

    if (!active) return fallback(texts);

    return new Promise((resolve) => {
      const id = nextId++;

      pending.set(id, { texts, resolve });

      try {
        active.postMessage({ id, texts } satisfies TokenWorkerRequest);
      } catch {
        fallBack();
      }
    });
  };

  return { count, dispose: fallBack };
}

/** The app's counter. The worker starts on the first count, never on import. */
export const backgroundTokenCounter = createBackgroundTokenCounter();

/** The default client counter. Never rejects. */
export const countTokensInBackground: TextTokenCounter = (texts) =>
  backgroundTokenCounter.count(texts);

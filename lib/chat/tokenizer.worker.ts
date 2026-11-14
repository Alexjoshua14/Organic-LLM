/**
 * Counts tokens off the main thread for `lib/chat/background-token-counter.ts`. Building the
 * tokenizer here (about 100 ms) and every count after it never block input.
 */
import { estimateTokenCountSync } from "@/lib/chat/tokenizer";

export type TokenWorkerRequest = { id: number; texts: string[] };
export type TokenWorkerResponse = { id: number; counts: number[] };

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TokenWorkerRequest>) => void) | null;
  postMessage: (message: TokenWorkerResponse) => void;
};

scope.onmessage = (event) => {
  const { id, texts } = event.data;

  scope.postMessage({ id, counts: texts.map(estimateTokenCountSync) });
};

export type FetchReply = {
  status?: number;
  body?: unknown;
  headers?: HeadersInit;
};

/**
 * Builds a JSON response for fetch-based tests.
 */
export function createJsonFetchResponse(reply: FetchReply = {}): Response {
  return new Response(
    reply.body === undefined ? null : JSON.stringify(reply.body),
    {
      status: reply.status ?? 200,
      headers: {
        "content-type": "application/json",
        ...(reply.headers ?? {}),
      },
    },
  );
}

/**
 * Installs a queue-backed global fetch mock and returns controls for tests.
 */
export function createMockFetch(replies: FetchReply[] = []) {
  const queue = [...replies];
  const originalFetch = globalThis.fetch;
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];

  const fetchMock = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    calls.push([input, init]);

    if (queue.length === 0) {
      throw new Error("Unexpected fetch call with no queued mock response");
    }

    return createJsonFetchResponse(queue.shift());
  };

  globalThis.fetch = fetchMock as unknown as typeof fetch;

  return {
    fetchMock,
    get calls() {
      return calls;
    },
    enqueue(reply: FetchReply) {
      queue.push(reply);
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

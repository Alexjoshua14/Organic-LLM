export type FetchReply = {
  status?: number;
  /** Serialized as JSON when set (unless `bodyText` is provided). */
  body?: unknown;
  /** Raw response body (e.g. HTML for menu import tests). */
  bodyText?: string;
  headers?: HeadersInit;
  contentType?: string;
  throwError?: Error;
};

export type MockFetchOptions = {
  /** When set, handles matching URLs before dequeuing the FIFO queue. */
  route?: (url: string, init?: RequestInit) => FetchReply | undefined;
};

function resolveFetchReply(
  url: string,
  init: RequestInit | undefined,
  queue: FetchReply[],
  route?: MockFetchOptions["route"]
): FetchReply {
  const routed = route?.(url, init);

  if (routed) {
    return routed;
  }

  if (queue.length === 0) {
    throw new Error(`Unexpected fetch call with no queued mock response: ${url}`);
  }

  return queue.shift()!;
}

/**
 * Builds a fetch Response for tests (JSON or raw text).
 */
export function createFetchResponse(reply: FetchReply = {}): Response {
  if (reply.bodyText !== undefined) {
    return new Response(reply.bodyText, {
      status: reply.status ?? 200,
      headers: {
        "content-type": reply.contentType ?? "text/html; charset=utf-8",
        ...(reply.headers ?? {}),
      },
    });
  }

  return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
    status: reply.status ?? 200,
    headers: {
      "content-type": reply.contentType ?? "application/json",
      ...(reply.headers ?? {}),
    },
  });
}

/** @deprecated Use `createFetchResponse` */
export function createJsonFetchResponse(reply: FetchReply = {}): Response {
  return createFetchResponse(reply);
}

/**
 * Installs a queue-backed global fetch mock and returns controls for tests.
 */
export function createMockFetch(replies: FetchReply[] = [], options: MockFetchOptions = {}) {
  const queue = [...replies];
  const originalFetch = globalThis.fetch;
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];

  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init]);

    const reply = resolveFetchReply(String(input), init, queue, options.route);

    if (reply.throwError) {
      throw reply.throwError;
    }

    return createFetchResponse(reply);
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

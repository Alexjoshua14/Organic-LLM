type JsonRequestInit = Omit<RequestInit, "body"> & {
  headers?: HeadersInit;
};

/**
 * Shared JSON request builder for route tests.
 */
export function createJsonRequest(
  url: string,
  body: unknown,
  init?: JsonRequestInit,
) {
  return new Request(url, {
    method: "POST",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

/**
 * Shared GET request builder for route tests.
 */
export function createGetRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    method: "GET",
    ...init,
  });
}

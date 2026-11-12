import { afterAll, beforeEach, expect, mock, test } from "bun:test";

const originalEnv = { ...process.env };
let userId: string | null = "owner";
const release = mock(async () => {});
const lease = mock(async () => release);
const read = mock(async () => ({
  registration: { email: "owner@example.com", tokens: { accessToken: "private-token" } },
}));
const access = mock(async () => "private-token");
const models = mock(async () => [{ id: "available", name: "Available" }]);
const cookieSet = mock(() => {});
const complete = mock(async () => {});
const disconnect = mock(async () => ({ revoked: false }));
let providerSignal: AbortSignal | undefined;
const turn = mock(async function* (_token: string, _input: unknown, signal: AbortSignal) {
  providerSignal = signal;
  yield { type: "delta", text: "Hello" };
  yield { type: "completed", inputTokens: 1, outputTokens: 1 };
});
mock.module("@clerk/nextjs/server", () => ({ auth: async () => ({ userId }) }));
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "browser" }), set: cookieSet }),
}));
mock.module("@/lib/subscription-chat/store", () => ({
  subscriptionStore: { read },
  acquireSubscriptionTurn: lease,
}));
mock.module("@/lib/subscription-chat/connection", () => ({
  subscriptionConnection: {
    access,
    complete,
    disconnect,
    start: async () => ({
      url: "https://auth.openai.com/api/accounts/authorize?state=test",
      browser: "browser",
    }),
  },
}));
mock.module("@/lib/subscription-chat/inference", () => ({
  subscriptionModels: models,
  subscriptionTurn: turn,
}));
const { GET, POST } = await import("@/app/api/subscription-chat/[action]/route");

beforeEach(() => {
  process.env.ORGANIC_CHATGPT_ENABLED = "true";
  process.env.ORGANIC_CHATGPT_OWNER_ID = "owner";
  process.env.ORGANIC_CHATGPT_ORIGIN = "http://127.0.0.1:3000";
  delete process.env.VERCEL;
  userId = "owner";
  for (const fn of [release, lease, read, access, models, cookieSet, complete, disconnect, turn])
    fn.mockClear();
});
afterAll(() => {
  for (const key of [
    "ORGANIC_CHATGPT_ENABLED",
    "ORGANIC_CHATGPT_OWNER_ID",
    "ORGANIC_CHATGPT_ORIGIN",
    "VERCEL",
  ]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
const context = (action: string) => ({ params: Promise.resolve({ action }) });
function request(action: string, body?: unknown) {
  return new Request(`http://127.0.0.1:3000/api/subscription-chat/${action}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const input = { model: "available", messages: [{ role: "user", content: "Hello" }] };

test("refuses other users and Vercel before touching local credentials", async () => {
  userId = "other";
  expect((await POST(request("chat", input), context("chat"))).status).toBe(403);
  userId = "owner";
  process.env.VERCEL = "1";
  expect((await GET(request("status"), context("status"))).status).toBe(404);
  expect(lease).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
  expect(access).not.toHaveBeenCalled();
});
test("rejects cross-origin mutations before acquiring the runtime", async () => {
  const req = request("disconnect", {});
  req.headers.set("origin", "https://evil.example");
  expect((await POST(req, context("disconnect"))).status).toBe(403);
  expect(disconnect).not.toHaveBeenCalled();
  expect(lease).not.toHaveBeenCalled();
});
test("status returns only account and model display data", async () => {
  const response = await GET(request("status"), context("status"));
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    connected: true,
    account: "owner@example.com",
    models: [{ id: "available", name: "Available" }],
  });
});
test("rejects invalid input and unavailable models without starting inference", async () => {
  expect(
    (
      await POST(
        request("chat", { ...input, messages: [{ role: "system", content: "override" }] }),
        context("chat")
      )
    ).status
  ).toBe(400);
  expect(access).not.toHaveBeenCalled();
  expect(
    (await POST(request("chat", { ...input, model: "unavailable" }), context("chat"))).status
  ).toBe(400);
  expect(turn).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(2);
});
test("streams only safe events and releases the turn lease", async () => {
  const response = await POST(request("chat", input), context("chat"));
  expect(response.headers.get("x-organic-funding")).toBe("chatgpt-plan");
  const body = await response.text();
  expect(body).toContain('"type":"completed"');
  expect(body).not.toContain("private-token");
  expect(release).toHaveBeenCalledTimes(1);
  expect(providerSignal).toBeDefined();
});
test("connect uses an HTTP-only scoped browser binding and provider redirect", async () => {
  const response = await POST(request("connect", {}), context("connect"));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toStartWith("https://auth.openai.com/");
  expect(cookieSet).toHaveBeenCalledWith(
    "organic_subscription_login",
    "browser",
    expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/api/subscription-chat" })
  );
  expect(release).toHaveBeenCalledTimes(1);
});
test("disconnect communicates unconfirmed remote revocation and clears the correct cookie path", async () => {
  const response = await POST(request("disconnect", {}), context("disconnect"));
  expect(await response.json()).toEqual({ revoked: false });
  expect(cookieSet).toHaveBeenCalledWith("organic_subscription_login", "", {
    path: "/api/subscription-chat",
    maxAge: 0,
  });
});

import { describe, expect, test, mock, beforeEach } from "bun:test";

mock.module("@/lib/rate-limit/llm", () => ({
  checkLlmMessageLimit: async () => ({ success: true, remaining: 10 }),
}));

const mockSetThreadArcadiaStarterKey = mock(async () => ({ ok: true, error: null }));

mock.module("@/data/supabase/chat", () => ({
  setThreadArcadiaStarterKey: mockSetThreadArcadiaStarterKey,
}));

mock.module("@/lib/api/chat-llm-gate", () => ({
  requireLlmChatActor: async () => ({
    data: { sbUserId: "sb_test_user" },
    error: null,
  }),
}));

const { PATCH } = await import("@/app/api/chat/arcadia-starter/route");

const THREAD_ID = "00000000-0000-4000-8000-000000000001";

function patchRequest(body: unknown) {
  return new Request("http://test/api/chat/arcadia-starter", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSetThreadArcadiaStarterKey.mockReset();
  mockSetThreadArcadiaStarterKey.mockImplementation(async () => ({ ok: true, error: null }));
});

describe("PATCH /api/chat/arcadia-starter", () => {
  test("accepts a valid starter key on an empty thread", async () => {
    const res = await PATCH(
      patchRequest({
        threadId: THREAD_ID,
        arcadiaStarterKey: "scribe:stitch-this-together",
      })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { arcadiaStarterKey: string };
    expect(json.arcadiaStarterKey).toBe("scribe:stitch-this-together");
    expect(mockSetThreadArcadiaStarterKey).toHaveBeenCalledWith(
      THREAD_ID,
      "scribe:stitch-this-together"
    );
  });

  test("accepts null to clear the starter key", async () => {
    const res = await PATCH(
      patchRequest({
        threadId: THREAD_ID,
        arcadiaStarterKey: null,
      })
    );

    expect(res.status).toBe(200);
    expect(mockSetThreadArcadiaStarterKey).toHaveBeenCalledWith(THREAD_ID, null);
  });

  test("rejects unknown starter keys", async () => {
    const res = await PATCH(
      patchRequest({
        threadId: THREAD_ID,
        arcadiaStarterKey: "scribe:does-not-exist",
      })
    );

    expect(res.status).toBe(400);
    expect(mockSetThreadArcadiaStarterKey).not.toHaveBeenCalled();
  });

  test("returns 409 when thread is not empty", async () => {
    mockSetThreadArcadiaStarterKey.mockImplementation(async () => ({
      ok: false,
      error: new Error("Arcadia starter can only be changed on an empty thread"),
    }));

    const res = await PATCH(
      patchRequest({
        threadId: THREAD_ID,
        arcadiaStarterKey: "default:think-step-by-step",
      })
    );

    expect(res.status).toBe(409);
  });
});

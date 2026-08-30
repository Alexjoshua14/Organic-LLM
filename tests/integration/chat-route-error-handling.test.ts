import { describe, expect, test, mock, beforeEach } from "bun:test";

/**
 * The failure mode this guards against: an unhandled throw in POST /api/chat used to
 * escape into Next.js, which answered with an HTML error document. The AI SDK then
 * rejected with that markup as the error message and the chat client rendered it
 * verbatim. Every path here must return JSON carrying an error id and a stage.
 */

const mockRequireLlmChatActor = mock(async () => ({
  data: { sbUserId: "sb_test_user", clerkUserId: "user_test" },
  error: null as Response | null,
}));

mock.module("@/lib/api/chat-llm-gate", () => ({
  requireLlmChatActor: mockRequireLlmChatActor,
}));

mock.module("@/lib/observability/error-access", () => ({
  canSeeErrorDetail: async () => true,
}));

mock.module("@/data/supabase/chat", () => ({
  getThreadHasTitle: async () => ({ data: false, error: null }),
  getThreadArcadiaStarterKey: async () => ({ data: null, error: null }),
  getMessages: async () => ({ data: [], error: null }),
  getMessageCount: async () => ({ data: 0, error: null }),
}));

mock.module("@/data/supabase/profiles", () => ({
  isAdminUser: async () => false,
  getSupabaseUserId: async () => ({ data: "sb_test_user", error: null }),
  getShowSandboxGateway: async () => false,
}));

mock.module("resumable-stream", () => ({
  createResumableStreamContext: () => ({
    createNewResumableStream: async () => undefined,
  }),
}));

const { POST } = await import("@/app/api/chat/route");

const THREAD_ID = "00000000-0000-4000-8000-000000000042";

function chatRequest(body: string) {
  return new Request("http://test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

type ErrorBody = {
  error: string;
  status: number;
  errorId: string;
  stage: string;
  detail?: { message: string; stack?: string; context?: Record<string, unknown> };
};

beforeEach(() => {
  mockRequireLlmChatActor.mockReset();
  mockRequireLlmChatActor.mockImplementation(async () => ({
    data: { sbUserId: "sb_test_user", clerkUserId: "user_test" },
    error: null,
  }));
});

describe("POST /api/chat error handling", () => {
  test("malformed JSON returns a 400 JSON body tagged with the parse stage", async () => {
    const res = await POST(chatRequest("{not json"));

    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/json");

    const body = (await res.json()) as ErrorBody;

    expect(body.stage).toBe("parse_body");
    expect(body.errorId).toStartWith("err_");
    expect(res.headers.get("x-organic-error-id")).toBe(body.errorId);
  });

  test("schema failures name the offending field instead of just 'Invalid request body'", async () => {
    const res = await POST(
      chatRequest(JSON.stringify({ id: THREAD_ID, experience: "arcadia" }))
    );

    expect(res.status).toBe(400);

    const body = (await res.json()) as ErrorBody;

    expect(body.error).toBe("Invalid request body");
    expect(body.stage).toBe("validate_body");
    expect(body.detail?.message).toContain("message");
    // Identifiers are recovered from the raw body so a schema failure is still traceable.
    expect(body.detail?.context?.chatId).toBe(THREAD_ID);
    expect(body.detail?.context?.experience).toBe("arcadia");
  });

  test("a throwing auth gate answers with JSON, not an HTML error page", async () => {
    // Mirrors a misconfigured/unreachable Upstash: the rate limiter throws and the
    // whole handler used to 500 with an opaque HTML document.
    mockRequireLlmChatActor.mockImplementation(async () => {
      throw new Error("fetch failed: Upstash unreachable");
    });

    const res = await POST(
      chatRequest(
        JSON.stringify({
          id: THREAD_ID,
          experience: "arcadia",
          message: { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
        })
      )
    );

    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe("application/json");

    const raw = await res.text();

    expect(raw).not.toContain("<!DOCTYPE");
    expect(raw).not.toContain("<html");

    const body = JSON.parse(raw) as ErrorBody;

    expect(body.stage).toBe("auth_gate");
    expect(body.errorId).toStartWith("err_");
    expect(body.detail?.message).toContain("Upstash unreachable");
    expect(body.detail?.stack).toBeDefined();
    expect(body.detail?.context?.experience).toBe("arcadia");
    expect(body.detail?.context?.chatId).toBe(THREAD_ID);
  });

  test("the gate's own 401/429 responses still pass through unchanged", async () => {
    mockRequireLlmChatActor.mockImplementation(async () => ({
      data: null,
      error: new Response(JSON.stringify({ error: "Unauthorized", status: 401 }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    }));

    const res = await POST(
      chatRequest(
        JSON.stringify({
          id: THREAD_ID,
          experience: "arcadia",
          message: { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
        })
      )
    );

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });
});

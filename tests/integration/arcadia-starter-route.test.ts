import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createArcadiaStarterHandler } from "@/lib/api/arcadia-starter-handler";

const THREAD_ID = "00000000-0000-4000-8000-000000000001";

const requireActor = mock(async () => ({ data: { sbUserId: "sb_test_user" }, error: null }));
const setStarterKey = mock(async (_threadId: string, _key: string | null) => ({
  ok: true,
  error: null as { message?: string } | null,
}));

// Injected dependencies, no module stubs: stubbing @/data/supabase/chat and the LLM gate by
// module path did not take effect on the Linux runner, so the route reached the real database
// and each test timed out.
const PATCH = createArcadiaStarterHandler({
  requireActor,
  setStarterKey,
} as unknown as Parameters<typeof createArcadiaStarterHandler>[0]);

function patchRequest(body: unknown) {
  return new Request("http://test/api/chat/arcadia-starter", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireActor.mockClear();
  setStarterKey.mockReset();
  setStarterKey.mockImplementation(async () => ({ ok: true, error: null }));
});

describe("PATCH /api/chat/arcadia-starter", () => {
  test("accepts a valid starter key on an empty thread", async () => {
    const res = await PATCH(
      patchRequest({ threadId: THREAD_ID, arcadiaStarterKey: "scribe:stitch-this-together" })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { arcadiaStarterKey: string };

    expect(json.arcadiaStarterKey).toBe("scribe:stitch-this-together");
    expect(setStarterKey).toHaveBeenCalledWith(THREAD_ID, "scribe:stitch-this-together");
  });

  test("accepts null to clear the starter key", async () => {
    const res = await PATCH(patchRequest({ threadId: THREAD_ID, arcadiaStarterKey: null }));

    expect(res.status).toBe(200);
    expect(setStarterKey).toHaveBeenCalledWith(THREAD_ID, null);
  });

  test("rejects unknown starter keys", async () => {
    const res = await PATCH(
      patchRequest({ threadId: THREAD_ID, arcadiaStarterKey: "scribe:does-not-exist" })
    );

    expect(res.status).toBe(400);
    expect(setStarterKey).not.toHaveBeenCalled();
  });

  test("returns 409 when thread is not empty", async () => {
    setStarterKey.mockImplementation(async () => ({
      ok: false,
      error: new Error("Arcadia starter can only be changed on an empty thread"),
    }));

    const res = await PATCH(
      patchRequest({ threadId: THREAD_ID, arcadiaStarterKey: "default:think-step-by-step" })
    );

    expect(res.status).toBe(409);
  });

  test("returns 500 for any other failure", async () => {
    setStarterKey.mockImplementation(async () => ({
      ok: false,
      error: new Error("connection reset"),
    }));

    const res = await PATCH(
      patchRequest({ threadId: THREAD_ID, arcadiaStarterKey: "default:think-step-by-step" })
    );

    expect(res.status).toBe(500);
  });

  test("rejects an unauthenticated caller and malformed bodies before saving", async () => {
    requireActor.mockResolvedValueOnce({
      data: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never);

    expect(
      (await PATCH(patchRequest({ threadId: THREAD_ID, arcadiaStarterKey: null }))).status
    ).toBe(401);
    expect(
      (await PATCH(patchRequest({ threadId: "not-a-uuid", arcadiaStarterKey: null }))).status
    ).toBe(400);
    expect(
      (await PATCH(new Request("http://test/x", { method: "PATCH", body: "not json" }))).status
    ).toBe(400);
    expect(setStarterKey).not.toHaveBeenCalled();
  });
});

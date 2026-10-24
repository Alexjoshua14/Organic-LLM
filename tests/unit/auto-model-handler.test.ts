import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAutoModelHandler } from "@/lib/api/auto-model-handler";

const decision = {
  selectedSelectorId: "auto",
  routedModelId: "anthropic/claude-sonnet-5.5",
  routedModelLabel: "Sonnet 5.5",
  routedModelFullTitle: "Claude Sonnet 5.5",
  activityState: "typing",
  domain: "general",
  reason: "heuristic",
  zdr: true,
  changedMaterially: false,
};
const actor = { sbUserId: "sb_user", clerkUserId: "clerk_user" };

const requireActor = mock(async () => ({ data: actor, error: null }));
const planBudgetAllows = mock(async (_actor: typeof actor) => true);
const route = mock(async (_input: unknown, _options?: unknown) => decision);
const generateGate = mock(async () => ({ object: {} }));
const generatePicker = mock(async () => ({ object: {} }));
let gatewayKey = true;

const POST = createAutoModelHandler({
  requireActor,
  planBudgetAllows,
  route,
  generateGate,
  generatePicker,
  hasGatewayKey: () => gatewayKey,
} as unknown as Parameters<typeof createAutoModelHandler>[0]);

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/chat/auto-model", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
const routerOptions = () => route.mock.calls[0]?.[1];

describe("POST /api/chat/auto-model", () => {
  beforeEach(() => {
    requireActor.mockClear();
    planBudgetAllows.mockClear();
    planBudgetAllows.mockResolvedValue(true);
    route.mockClear();
    route.mockResolvedValue(decision);
    gatewayKey = true;
  });

  test("the heuristic router makes no model call and never reads the plan budget", async () => {
    const res = await post({ text: "hello" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ routedModelId: decision.routedModelId });
    expect(planBudgetAllows).not.toHaveBeenCalled();
    expect(routerOptions()).toEqual({});
  });

  test("a live request within budget routes through the budget-aware model calls", async () => {
    const res = await post({ text: "hello", useLiveLlm: true });

    expect(res.status).toBe(200);
    expect(planBudgetAllows).toHaveBeenCalledWith(actor);
    expect(routerOptions()).toEqual({
      useLiveJev: true,
      useLivePicker: true,
      generateGate,
      generatePicker,
    });
  });

  test("a spent plan degrades to the free heuristic router instead of failing the composer", async () => {
    planBudgetAllows.mockResolvedValue(false);
    const res = await post({ text: "hello", useLiveLlm: true });

    expect(res.status).toBe(200);
    expect(routerOptions()).toEqual({});
  });

  test("without a gateway key a live request stays on the heuristic router", async () => {
    gatewayKey = false;
    const res = await post({ text: "hello", useLiveLlm: true });

    expect(res.status).toBe(200);
    expect(planBudgetAllows).not.toHaveBeenCalled();
    expect(routerOptions()).toEqual({});
  });

  test("an error while routing live falls back to the heuristic decision", async () => {
    route.mockRejectedValueOnce(new Error("provider down"));
    const res = await post({ text: "hello", useLiveLlm: true });

    expect(res.status).toBe(200);
    expect(route).toHaveBeenCalledTimes(2);
    expect(route.mock.calls[1]?.[1]).toBeUndefined();
  });

  test("rejects an unauthenticated caller and malformed bodies before routing", async () => {
    requireActor.mockResolvedValueOnce({
      data: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never);

    expect((await post({ text: "hello", useLiveLlm: true })).status).toBe(401);
    expect(
      (await POST(new Request("http://localhost/x", { method: "POST", body: "not json" }))).status
    ).toBe(400);
    expect((await post({ text: 5 })).status).toBe(400);
    expect(route).not.toHaveBeenCalled();
  });
});

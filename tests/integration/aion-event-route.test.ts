import { describe, test, expect, mock, beforeEach } from "bun:test";

import type { AionEvent } from "@/lib/schemas/aion-presence";

const sampleEvent: AionEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "button",
  surface: "event-bench",
  label: "pressed Save",
  at: 1_700_000_000_000,
};

describe("createAionEventHandler (integration)", () => {
  const mockAuth = mock(async () => ({ userId: "clerk_test_user" }));
  const mockGetSupabaseUserId = mock(async () => ({
    data: "sb_test_user",
    error: null,
  }));
  const mockCheckLlmMessageLimit = mock(async () => ({ success: true, remaining: 10 }));
  const mockCheckAionPresenceTurn = mock(async () => ({
    success: true,
    remaining: 100,
    budget: {
      dailyTurnCap: 200,
      dailyTurnsRemaining: 199,
      dailyTurnsUsed: 1,
      dailyCostCapUsd: 1,
      dailyCostUsedUsd: 0.001,
      dailyCostRemainingUsd: 0.999,
      perMinuteCap: 12,
      perMinuteRemaining: 11,
      enabled: true,
    },
  }));
  const mockRecordAionPresenceUsage = mock(async () => ({
    costUsd: 0.0002,
    budget: {
      dailyTurnCap: 200,
      dailyTurnsRemaining: 198,
      dailyTurnsUsed: 2,
      dailyCostCapUsd: 1,
      dailyCostUsedUsd: 0.0012,
      dailyCostRemainingUsd: 0.9988,
      perMinuteCap: 12,
      perMinuteRemaining: 10,
      enabled: true,
    },
  }));
  const mockResolveFeatureThread = mock(async () => ({
    threadId: "11111111-1111-4111-8111-111111111111",
    resumed: true,
    title: "Presence",
  }));
  const mockLoadSessionContext = mock(async () => ({
    summary: "We talked about presence.",
    recentTurns: [{ role: "user" as const, text: "hi" }],
    memories: [],
  }));
  const mockFormatSessionContext = mock(() => "Conversation so far:\nWe talked about presence.");
  const mockGenerateText = mock(async () => ({
    text: "Noted — saved.",
    usage: { inputTokens: 200, outputTokens: 8 },
  }));
  const mockPersist = mock(async () => ({
    ok: true as const,
    persisted: 2,
    postProcess: async () => {},
  }));
  const afterCalls: Array<() => void> = [];
  const mockAfter = mock((fn: () => void) => {
    afterCalls.push(fn);
  });

  beforeEach(() => {
    mockAuth.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockCheckLlmMessageLimit.mockClear();
    mockCheckAionPresenceTurn.mockClear();
    mockRecordAionPresenceUsage.mockClear();
    mockResolveFeatureThread.mockClear();
    mockLoadSessionContext.mockClear();
    mockFormatSessionContext.mockClear();
    mockGenerateText.mockClear();
    mockPersist.mockClear();
    mockAfter.mockClear();
    afterCalls.length = 0;
  });

  async function makeHandler() {
    const { createAionEventHandler } = await import("@/lib/api/aion-event-handler");

    return createAionEventHandler({
      auth: mockAuth as any,
      getSupabaseUserId: mockGetSupabaseUserId as any,
      checkLlmMessageLimit: mockCheckLlmMessageLimit as any,
      checkAionPresenceTurn: mockCheckAionPresenceTurn as any,
      recordAionPresenceUsage: mockRecordAionPresenceUsage as any,
      resolveFeatureThread: mockResolveFeatureThread as any,
      loadSessionContext: mockLoadSessionContext as any,
      formatSessionContext: mockFormatSessionContext as any,
      generateText: mockGenerateText as any,
      persistAionPresenceTurns: mockPersist as any,
      after: mockAfter,
      now: () => 1_700_000_000_100,
      randomId: () => "22222222-2222-4222-8222-222222222222",
    });
  }

  function createJsonRequest(body: unknown) {
    return new Request("http://test/api/ai/aion/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  test("returns a reply, persists turns, and records usage", async () => {
    const handler = await makeHandler();
    const res = await handler(
      createJsonRequest({
        event: sampleEvent,
        threadPolicy: "resume-latest",
        ledger: [],
        memory: false,
      })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      text: string | null;
      silent: boolean;
      threadId: string;
      usage?: { costUsd?: number };
    };

    expect(json.silent).toBe(false);
    expect(json.text).toBe("Noted — saved.");
    expect(json.threadId).toBe("11111111-1111-4111-8111-111111111111");
    expect(json.usage?.costUsd).toBe(0.0002);
    expect(mockPersist).toHaveBeenCalled();
    expect(mockRecordAionPresenceUsage).toHaveBeenCalled();
    expect(mockAfter).toHaveBeenCalled();
  });

  test("treats [silent] as a null reply still billed", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({
      text: "[silent]",
      usage: { inputTokens: 100, outputTokens: 1 },
    }));

    const handler = await makeHandler();
    const res = await handler(createJsonRequest({ event: sampleEvent }));
    const json = (await res.json()) as { text: string | null; silent: boolean };

    expect(res.status).toBe(200);
    expect(json.silent).toBe(true);
    expect(json.text).toBeNull();
    expect(mockPersist).toHaveBeenCalled();
    const persistArgs = mockPersist.mock.calls[0]?.[0] as { replyText: string | null };

    expect(persistArgs.replyText).toBeNull();
  });

  test("denies when the presence budget is exhausted", async () => {
    mockCheckAionPresenceTurn.mockImplementationOnce(async () => ({
      success: false,
      error: "Daily Aion presence turn limit exceeded",
      budget: {
        dailyTurnCap: 200,
        dailyTurnsRemaining: 0,
        dailyTurnsUsed: 200,
        dailyCostCapUsd: 1,
        dailyCostUsedUsd: 0.5,
        dailyCostRemainingUsd: 0.5,
        perMinuteCap: 12,
        perMinuteRemaining: 12,
        enabled: true,
      },
    }));

    const handler = await makeHandler();
    const res = await handler(createJsonRequest({ event: sampleEvent }));
    const json = (await res.json()) as { error?: string; silent: boolean; text: string | null };

    expect(res.status).toBe(429);
    expect(json.silent).toBe(true);
    expect(json.text).toBeNull();
    expect(json.error).toContain("Daily Aion presence");
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
  });
});

import { describe, expect, test } from "bun:test";

import type { MultitaskViewSyncPayload } from "@/lib/arcadia/multitask/view-sync";

import { MULTITASK_VIEW_BROADCAST_CHANNEL } from "@/lib/arcadia/multitask/view-sync";

describe("BroadcastChannel multitask view sync", () => {
  test("another subscriber receives the thread id + boolean payload", async () => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const received: MultitaskViewSyncPayload[] = [];
    const listener = new BroadcastChannel(MULTITASK_VIEW_BROADCAST_CHANNEL);

    listener.onmessage = (ev: MessageEvent<MultitaskViewSyncPayload>) => {
      received.push(ev.data);
    };

    const sender = new BroadcastChannel(MULTITASK_VIEW_BROADCAST_CHANNEL);
    const payload: MultitaskViewSyncPayload = {
      threadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      enabled: true,
      updatedAt: Date.now(),
    };

    sender.postMessage(payload);
    sender.close();

    await new Promise((r) => setTimeout(r, 20));

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]?.threadId).toBe(payload.threadId);
    expect(received[0]?.enabled).toBe(true);

    listener.close();
  });
});

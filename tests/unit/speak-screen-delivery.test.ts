import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import { AMBIENT_CLEARED_BODY, AMBIENT_LABEL } from "@/lib/speak/ambient-item";
import {
  createRealtimeVoiceHarness,
  deferred,
  systemItemTexts,
  type FakeVoiceTransport,
  type RealtimeVoiceHarness,
  type SpeakRouteHandler,
} from "../helpers/mock-realtime-voice";
import { ensureDom } from "../helpers/render";
import { CHAT_THREAD_ID, RABBIT_HOLE_SESSION_ID } from "../helpers/speak-fixtures";

ensureDom();

/**
 * How `sendScreenContext` hands the model its screen: one silent `[Screen]` item at a time, each
 * replacing the last, latest surface wins, and nothing it does can surface as a user-facing error.
 */

let harness: RealtimeVoiceHarness;
let restoreFetch: () => void;

function useHarness(context: SpeakRouteHandler) {
  restoreFetch?.();
  harness = createRealtimeVoiceHarness({ context });
  restoreFetch = harness.install();
}

beforeEach(() => {
  useHarness((body) => ({ body: `context for ${JSON.stringify(body.surface)}` }));
});

afterEach(() => {
  restoreFetch();
});

async function liveCall() {
  const hook = renderHook(() => useRealtimeVoice({ transportFactory: harness.transportFactory }));

  await act(async () => {
    await hook.result.current.connect();
  });

  expect(hook.result.current.connected).toBe(true);

  return hook;
}

async function push(
  hook: Awaited<ReturnType<typeof liveCall>>,
  surface: SpeakScreenSurface
): Promise<void> {
  await act(async () => {
    await hook.result.current.sendScreenContext(surface);
  });
}

const node = (activeNodeId: string): SpeakScreenSurface => ({
  kind: "rabbit-hole",
  id: RABBIT_HOLE_SESSION_ID,
  activeNodeId,
});

const chat = (revision?: string): SpeakScreenSurface => ({
  kind: "chat",
  id: CHAT_THREAD_ID,
  revision,
});

type SentItem = { type: string; event_id?: string; item_id?: string; item?: { id?: string } };

/** Ambient creates and deletes, in the order they went up the data channel. */
function ambientTraffic(transport: FakeVoiceTransport) {
  return (transport.sent as SentItem[])
    .filter((e) => e.type === "conversation.item.create" || e.type === "conversation.item.delete")
    .map((e) =>
      e.type === "conversation.item.create" ? `add ${e.item?.id}` : `delete ${e.item_id}`
    );
}

describe("sendScreenContext delivery", () => {
  test("sends the body as a silent [Screen] system item, never a response trigger", async () => {
    useHarness(() => ({ body: "The user opened a page." }));

    const hook = await liveCall();

    await push(hook, node("n2"));

    expect(harness.callsTo("context")[0]!.body.surface).toEqual(node("n2"));
    expect(systemItemTexts(harness.transport)).toEqual([
      `${AMBIENT_LABEL}\nThe user opened a page.`,
    ]);
    expect(harness.transport.sent.some((e) => e.type === "response.create")).toBe(false);
    hook.unmount();
  });

  test("each push replaces the last: the new item is added, then the old one deleted", async () => {
    const hook = await liveCall();

    await push(hook, node("n2"));
    await push(hook, node("n3"));
    await push(hook, chat());

    // Add-then-delete, so the model is never left without a screen item.
    expect(ambientTraffic(harness.transport)).toEqual([
      "add ambient_item_1",
      "add ambient_item_2",
      "delete ambient_item_1",
      "add ambient_item_3",
      "delete ambient_item_2",
    ]);
    hook.unmount();
  });

  test("every ambient event is tagged, so any error it causes can be recognised", async () => {
    const hook = await liveCall();

    await push(hook, node("n2"));
    await push(hook, node("n3"));

    const ambient = (harness.transport.sent as SentItem[]).filter((e) =>
      e.type.startsWith("conversation.item.")
    );

    expect(ambient.length).toBe(3);
    expect(ambient.every((e) => e.event_id?.startsWith("ambient_"))).toBe(true);
    hook.unmount();
  });

  test("a new chat revision re-pushes the same thread", async () => {
    const hook = await liveCall();

    await push(hook, chat("m2"));
    await push(hook, chat("m4"));

    expect(harness.callsTo("context").map((c) => c.body.surface)).toEqual([chat("m2"), chat("m4")]);
    expect(ambientTraffic(harness.transport)).toContain("delete ambient_item_1");
    hook.unmount();
  });

  test("does not re-send the surface it last sent", async () => {
    const hook = await liveCall();

    await push(hook, node("n2"));
    await push(hook, node("n2"));

    expect(harness.callsTo("context")).toHaveLength(1);
    hook.unmount();
  });

  test("nothing to describe still replaces the old screen, with the cleared notice", async () => {
    useHarness((body) =>
      (body.surface as SpeakScreenSurface).kind === "chat"
        ? { body: "", label: "Chat", reason: "not-owner" }
        : { body: "Rabbit hole context", label: "Rabbit hole · Mains hum" }
    );

    const hook = await liveCall();

    await push(hook, node("n2"));
    await push(hook, chat());

    expect(systemItemTexts(harness.transport)[1]).toBe(`${AMBIENT_LABEL}\n${AMBIENT_CLEARED_BODY}`);
    // The rabbit hole is gone: the model is not left describing a page the user left.
    expect(ambientTraffic(harness.transport)).toContain("delete ambient_item_1");
    hook.unmount();
  });

  test("a late reply for a node the user already left is dropped", async () => {
    const replies = { n2: deferred(), n3: deferred() };

    useHarness(async (body) => {
      const id = (body.surface as { activeNodeId: "n2" | "n3" }).activeNodeId;

      await replies[id].promise;

      return { body: `context for ${id}` };
    });

    const hook = await liveCall();

    let first!: Promise<void>;
    let second!: Promise<void>;

    act(() => {
      first = hook.result.current.sendScreenContext(node("n2"));
      second = hook.result.current.sendScreenContext(node("n3"));
    });

    // The newer request answers first, then the stale one straggles in.
    await act(async () => {
      replies.n3.resolve();
      await second;
    });
    await act(async () => {
      replies.n2.resolve();
      await first;
    });

    expect(systemItemTexts(harness.transport)).toEqual([`${AMBIENT_LABEL}\ncontext for n3`]);
    hook.unmount();
  });
});

describe("sendScreenContext errors", () => {
  test("an error from our own screen housekeeping never reaches the user", async () => {
    const hook = await liveCall();

    await push(hook, node("n2"));
    await push(hook, node("n3"));

    // The delete raced `retention_ratio` truncation: the old item was already evicted.
    act(() =>
      harness.transport.emit({
        type: "error",
        error: { message: "Item not found", event_id: "ambient_del_2" },
      })
    );

    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.connected).toBe(true);
    hook.unmount();
  });

  test("other errors still surface", async () => {
    const hook = await liveCall();

    act(() =>
      harness.transport.emit({
        type: "error",
        error: { message: "Rate limited", event_id: "evt_9" },
      })
    );

    expect(hook.result.current.error).toBe("Rate limited");
    hook.unmount();
  });
});

describe("sendScreenContext snapshot for the dev chip", () => {
  test("records what the model was last told, with its label", async () => {
    useHarness(() => ({ body: "Chat body", label: "Chat · Espresso grinders" }));

    const hook = await liveCall();

    await push(hook, chat("m4"));

    expect(hook.result.current.screenContext).toMatchObject({
      surfaceKey: `chat:${CHAT_THREAD_ID}:m4`,
      label: "Chat · Espresso grinders",
      body: "Chat body",
    });
    hook.unmount();
  });

  test("an empty push records why, alongside the cleared notice actually sent", async () => {
    useHarness(() => ({ body: "", label: "Chat", reason: "not-owner" }));

    const hook = await liveCall();

    await push(hook, chat());

    expect(hook.result.current.screenContext).toMatchObject({
      label: "Chat",
      body: AMBIENT_CLEARED_BODY,
      reason: "not-owner",
    });
    hook.unmount();
  });

  test("a new call starts clean: no snapshot, and nothing left over to delete", async () => {
    const hook = await liveCall();

    await push(hook, node("n2"));
    await act(async () => {
      await hook.result.current.disconnect();
    });

    expect(hook.result.current.screenContext).toBeNull();

    await act(async () => {
      await hook.result.current.connect();
    });
    await push(hook, node("n2"));

    // The new conversation never had item 1; deleting it would only provoke an error.
    expect(ambientTraffic(harness.transport)).toEqual(["add ambient_item_2"]);
    hook.unmount();
  });
});

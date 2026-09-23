import type { VoiceTransport, VoiceTransportEvents } from "@/lib/speak/transport/voice-transport";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";
import { createVoiceIdleTimer, SPEAK_IDLE_PAUSE_MS } from "@/lib/speak/voice-idle";
import { ensureDom } from "../helpers/render";

ensureDom();

/** Real timers, shortened. Waits are multiples of this so scheduling jitter cannot flip a result. */
const IDLE_MS = 40;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SPEAK_IDLE_PAUSE_MS", () => {
  test("stays inside the approved 15–20s range", () => {
    expect(SPEAK_IDLE_PAUSE_MS).toBeGreaterThanOrEqual(15_000);
    expect(SPEAK_IDLE_PAUSE_MS).toBeLessThanOrEqual(20_000);
  });
});

describe("createVoiceIdleTimer", () => {
  function timer() {
    let fired = 0;
    const t = createVoiceIdleTimer({ timeoutMs: IDLE_MS, onIdle: () => fired++ });

    return { t, fired: () => fired };
  }

  test("fires once after a full quiet window", async () => {
    const { t, fired } = timer();

    t.reset();
    await sleep(IDLE_MS / 4);
    expect(fired()).toBe(0);

    await sleep(IDLE_MS * 2);
    expect(fired()).toBe(1);

    await sleep(IDLE_MS * 2);
    expect(fired()).toBe(1);
    t.stop();
  });

  test("never fires while any activity is open", async () => {
    const { t, fired } = timer();

    t.reset();
    t.begin("response");
    t.begin("playback");
    t.end("response");
    await sleep(IDLE_MS * 3);

    expect(fired()).toBe(0);
    t.stop();
  });

  test("measures the window from the end of the last activity, not from connect", async () => {
    const { t, fired } = timer();

    t.reset();
    await sleep(IDLE_MS * 0.75);
    t.begin("user-speech");
    t.end("user-speech");
    await sleep(IDLE_MS * 0.75);

    expect(fired()).toBe(0);

    await sleep(IDLE_MS * 2);
    expect(fired()).toBe(1);
    t.stop();
  });

  test("ignores an end with no matching begin, so a duplicate event cannot restart the clock", async () => {
    const { t, fired } = timer();

    t.reset();
    await sleep(IDLE_MS * 0.75);
    t.end("playback");
    await sleep(IDLE_MS * 0.75);

    expect(fired()).toBe(1);
    t.stop();
  });

  test("stop cancels a pending countdown and forgets open activity", async () => {
    const { t, fired } = timer();

    t.begin("response");
    t.stop();
    t.end("response");
    await sleep(IDLE_MS * 3);

    expect(fired()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The hook, end to end over a fake transport
// ---------------------------------------------------------------------------

type FakeTransport = VoiceTransport & {
  events: VoiceTransportEvents | null;
  closed: boolean;
  sent: Array<Record<string, unknown>>;
};

type FetchCall = { url: string; body: Record<string, unknown> };

const originalFetch = globalThis.fetch;
let transports: FakeTransport[] = [];
let fetchCalls: FetchCall[] = [];
let releaseTool: (() => void) | null = null;

function fakeTransport(): FakeTransport {
  const transport: FakeTransport = {
    kind: "webrtc",
    localStream: null,
    remoteStream: null,
    events: null,
    closed: false,
    sent: [],
    async connect(_args, events) {
      transport.events = events;
    },
    send(event) {
      transport.sent.push(event);

      return true;
    },
    close() {
      transport.closed = true;
    },
  };

  transports.push(transport);

  return transport;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  transports = [];
  fetchCalls = [];
  releaseTool = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    fetchCalls.push({ url, body });

    if (url.endsWith("/realtime/session")) {
      const mints = fetchCalls.filter((c) => c.url.endsWith("/realtime/session")).length;

      return json({
        clientSecret: "secret",
        sessionId: `session-${mints}`,
        model: "gpt-realtime-2.1-mini",
        threadId: "thread-1",
        resumed: mints > 1,
        modalities: DEFAULT_SPEAK_MODALITIES,
      });
    }

    if (url.endsWith("/realtime/tool")) {
      await new Promise<void>((resolve) => {
        releaseTool = resolve;
      });

      return json({ ok: true, modelResult: { ok: true } });
    }

    return json({ ok: true });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function connectedHook() {
  const hook = renderHook(() =>
    useRealtimeVoice({ transportFactory: fakeTransport, idlePauseMs: IDLE_MS })
  );

  await act(async () => {
    await hook.result.current.connect();
  });

  expect(hook.result.current.connected).toBe(true);

  const emit = (event: Record<string, unknown>) =>
    act(() => transports.at(-1)!.events!.onServerEvent(JSON.stringify(event)));

  return { ...hook, emit };
}

describe("useRealtimeVoice idle pause", () => {
  test("pauses after a quiet stretch: call ended and settled, bar kept", async () => {
    const { result, unmount } = await connectedHook();

    await waitFor(() => expect(result.current.paused).toBe(true), { timeout: IDLE_MS * 10 });

    expect(result.current.connected).toBe(false);
    expect(transports[0]!.closed).toBe(true);
    expect(
      fetchCalls.some((c) => c.url.endsWith("/realtime/end") && c.body.sessionId === "session-1")
    ).toBe(true);
    unmount();
  });

  test("does not pause while the user is speaking", async () => {
    const { result, emit, unmount } = await connectedHook();

    emit({ type: "input_audio_buffer.speech_started" });
    await act(() => sleep(IDLE_MS * 3));
    expect(result.current.connected).toBe(true);

    emit({ type: "input_audio_buffer.speech_stopped" });
    await waitFor(() => expect(result.current.paused).toBe(true), { timeout: IDLE_MS * 10 });
    unmount();
  });

  test("waits for playback to drain, not just for response.done", async () => {
    const { result, emit, unmount } = await connectedHook();

    emit({ type: "response.created" });
    emit({ type: "output_audio_buffer.started" });
    emit({ type: "response.done" });
    await act(() => sleep(IDLE_MS * 3));
    expect(result.current.connected).toBe(true);

    emit({ type: "output_audio_buffer.stopped" });
    await waitFor(() => expect(result.current.paused).toBe(true), { timeout: IDLE_MS * 10 });
    unmount();
  });

  test("a running tool call holds the call open", async () => {
    const { result, emit, unmount } = await connectedHook();

    emit({
      type: "response.function_call_arguments.done",
      call_id: "call-1",
      name: "render_gen_ui",
      arguments: "{}",
    });
    emit({ type: "response.done" });
    await act(() => sleep(IDLE_MS * 3));
    expect(result.current.connected).toBe(true);

    await act(async () => {
      releaseTool?.();
      await sleep(0);
    });
    expect(transports[0]!.sent.some((e) => e.type === "response.create")).toBe(true);

    await waitFor(() => expect(result.current.paused).toBe(true), { timeout: IDLE_MS * 10 });
    unmount();
  });

  test("resume continues the paused thread rather than the latest one", async () => {
    const { result, unmount } = await connectedHook();

    await waitFor(() => expect(result.current.paused).toBe(true), { timeout: IDLE_MS * 10 });

    await act(async () => {
      await result.current.resume();
    });

    const mints = fetchCalls.filter((c) => c.url.endsWith("/realtime/session"));

    expect(mints).toHaveLength(2);
    expect(mints[1]!.body.threadId).toBe("thread-1");
    expect(result.current.connected).toBe(true);
    expect(result.current.paused).toBe(false);
    unmount();
  });

  test("ending a paused call dismisses it", async () => {
    const { result, unmount } = await connectedHook();

    await waitFor(() => expect(result.current.paused).toBe(true), { timeout: IDLE_MS * 10 });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.paused).toBe(false);
    unmount();
  });
});

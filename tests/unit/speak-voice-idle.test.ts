import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import { createVoiceIdleTimer, SPEAK_IDLE_PAUSE_MS } from "@/lib/speak/voice-idle";
import {
  createRealtimeVoiceHarness,
  deferred,
  speakReply,
  SPEAK_TEST_THREAD_ID,
  systemItemTexts,
  type RealtimeVoiceHarness,
} from "../helpers/mock-realtime-voice";
import { ensureDom } from "../helpers/render";

ensureDom();

/**
 * Everything here runs on fake timers against the production window, so "19.999s is not enough,
 * 20s is" is asserted exactly rather than approximated with short real sleeps.
 */
const WINDOW = SPEAK_IDLE_PAUSE_MS;
const JUST_UNDER = WINDOW - 1;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SPEAK_IDLE_PAUSE_MS", () => {
  test("stays inside the approved 15–20s range", () => {
    expect(WINDOW).toBeGreaterThanOrEqual(15_000);
    expect(WINDOW).toBeLessThanOrEqual(20_000);
  });
});

describe("createVoiceIdleTimer", () => {
  function timer() {
    let fired = 0;
    const t = createVoiceIdleTimer({ onIdle: () => fired++ });

    return { t, fired: () => fired };
  }

  test("defaults to the production window", () => {
    const { t, fired } = timer();

    t.reset();
    jest.advanceTimersByTime(JUST_UNDER);
    expect(fired()).toBe(0);

    jest.advanceTimersByTime(1);
    expect(fired()).toBe(1);
  });

  test("fires once, not on every window after", () => {
    const { t, fired } = timer();

    t.reset();
    jest.advanceTimersByTime(WINDOW * 5);

    expect(fired()).toBe(1);
  });

  test("never fires while any activity is open", () => {
    const { t, fired } = timer();

    t.reset();
    t.begin("response");
    t.begin("playback");
    t.end("response");
    jest.advanceTimersByTime(WINDOW * 5);

    expect(fired()).toBe(0);
    t.stop();
  });

  test("restarts from zero when the last activity ends, rather than accumulating", () => {
    const { t, fired } = timer();

    t.reset();
    jest.advanceTimersByTime(WINDOW - 5_000);
    t.begin("user-speech");
    t.end("user-speech");
    jest.advanceTimersByTime(JUST_UNDER);

    expect(fired()).toBe(0);

    jest.advanceTimersByTime(1);
    expect(fired()).toBe(1);
  });

  test("ignores an end with no matching begin, so a duplicate event cannot restart the clock", () => {
    const { t, fired } = timer();

    t.reset();
    jest.advanceTimersByTime(WINDOW - 5_000);
    t.end("playback");
    jest.advanceTimersByTime(5_000);

    expect(fired()).toBe(1);
  });

  test("stop cancels a pending countdown and forgets open activity", () => {
    const { t, fired } = timer();

    t.reset();
    t.begin("response");
    t.stop();
    t.end("response");
    jest.advanceTimersByTime(WINDOW * 5);

    expect(fired()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The hook over a fake transport
// ---------------------------------------------------------------------------

let harness: RealtimeVoiceHarness;
let restoreFetch: () => void;

beforeEach(() => {
  harness = createRealtimeVoiceHarness();
  restoreFetch = harness.install();
});

afterEach(() => {
  restoreFetch();
});

function voiceHook() {
  return renderHook(() => useRealtimeVoice({ transportFactory: harness.transportFactory }));
}

async function liveCall() {
  const hook = voiceHook();

  await act(async () => {
    await hook.result.current.connect();
  });

  expect(hook.result.current.connected).toBe(true);

  return hook;
}

/** Advances fake time inside `act`, letting the pause's async teardown settle. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

function emit(type: string, extra: Record<string, unknown> = {}) {
  act(() => harness.transport.emit({ type, ...extra }));
}

describe("idle pause: when the countdown starts", () => {
  test("nothing counts down before a call connects", async () => {
    const { result, unmount } = voiceHook();

    await advance(WINDOW * 3);

    expect(result.current.paused).toBe(false);
    expect(harness.transports).toHaveLength(0);
    expect(harness.callsTo("end")).toHaveLength(0);
    unmount();
  });

  test("opening the connection starts the countdown", async () => {
    const { result, unmount } = await liveCall();

    await advance(JUST_UNDER);
    expect(result.current.connected).toBe(true);
    expect(result.current.paused).toBe(false);

    await advance(1);
    expect(result.current.paused).toBe(true);
    unmount();
  });
});

describe("idle pause: the 20s window", () => {
  test("pauses 20s after the model's last activity", async () => {
    const { result, unmount } = await liveCall();

    await advance(10_000);
    emit("response.created");
    emit("output_audio_buffer.started");
    emit("response.done");
    await advance(5_000);
    emit("output_audio_buffer.stopped");

    // 35s since connect, so a window measured from connect would already have fired.
    await advance(JUST_UNDER);
    expect(result.current.connected).toBe(true);

    await advance(1);
    expect(result.current.paused).toBe(true);
    unmount();
  });

  test("less than the window leaves the call connected", async () => {
    const { result, unmount } = await liveCall();

    await advance(JUST_UNDER);

    expect(result.current.connected).toBe(true);
    expect(result.current.paused).toBe(false);
    expect(harness.transport.closed).toBe(false);
    expect(harness.callsTo("end")).toHaveLength(0);
    unmount();
  });

  test("a pause ends the call: transport closed, session settled, thread kept", async () => {
    const { result, unmount } = await liveCall();

    await advance(WINDOW);

    expect(result.current.paused).toBe(true);
    expect(result.current.connected).toBe(false);
    expect(harness.transport.closed).toBe(true);
    expect(harness.callsTo("end").map((c) => c.body.sessionId)).toEqual(["session-1"]);
    expect(result.current.threadId).toBe(SPEAK_TEST_THREAD_ID);
    unmount();
  });
});

describe("idle pause: sustained activity is not idle", () => {
  test("a user talking for longer than the window keeps the call open", async () => {
    const { result, unmount } = await liveCall();

    emit("input_audio_buffer.speech_started");
    await advance(WINDOW * 3);
    expect(result.current.connected).toBe(true);

    emit("input_audio_buffer.speech_stopped");
    await advance(JUST_UNDER);
    expect(result.current.connected).toBe(true);

    await advance(1);
    expect(result.current.paused).toBe(true);
    unmount();
  });

  test("a model answer longer than the window keeps the call open until playback drains", async () => {
    const { result, unmount } = await liveCall();

    emit("response.created");
    emit("output_audio_buffer.started");
    await advance(WINDOW * 1.5);
    // Generation is done, but on WebRTC the audio is still playing.
    emit("response.done");
    await advance(WINDOW * 1.5);
    expect(result.current.connected).toBe(true);

    emit("output_audio_buffer.stopped");
    await advance(JUST_UNDER);
    expect(result.current.connected).toBe(true);

    await advance(1);
    expect(result.current.paused).toBe(true);
    unmount();
  });

  test("the model thinking for longer than the window keeps the call open", async () => {
    const { result, unmount } = await liveCall();

    emit("response.created");
    await advance(WINDOW * 3);
    expect(result.current.connected).toBe(true);

    emit("response.done");
    await advance(WINDOW);
    expect(result.current.paused).toBe(true);
    unmount();
  });

  test("an interruption that clears playback restarts the countdown", async () => {
    const { result, unmount } = await liveCall();

    emit("output_audio_buffer.started");
    await advance(WINDOW * 2);
    emit("output_audio_buffer.cleared");
    await advance(JUST_UNDER);
    expect(result.current.connected).toBe(true);

    await advance(1);
    expect(result.current.paused).toBe(true);
    unmount();
  });

  test("a tool call longer than the window keeps the call open", async () => {
    const tool = deferred();

    restoreFetch();
    harness = createRealtimeVoiceHarness({
      tool: async () => {
        await tool.promise;

        return { ok: true, modelResult: { ok: true } };
      },
    });
    restoreFetch = harness.install();

    const { result, unmount } = await liveCall();

    emit("response.function_call_arguments.done", {
      call_id: "call-1",
      name: "render_gen_ui",
      arguments: "{}",
    });
    emit("response.done");
    await advance(WINDOW * 3);
    expect(result.current.connected).toBe(true);

    await act(async () => {
      tool.resolve();
    });
    expect(harness.transport.sent.some((e) => e.type === "response.create")).toBe(true);

    await advance(JUST_UNDER);
    expect(result.current.connected).toBe(true);

    await advance(1);
    expect(result.current.paused).toBe(true);
    unmount();
  });
});

describe("idle pause: ending and resuming", () => {
  test("ending the call clears the countdown and shuts the connection down", async () => {
    const { result, unmount } = await liveCall();

    await advance(10_000);
    // The idle countdown and the heartbeat interval.
    expect(jest.getTimerCount()).toBe(2);

    await act(async () => {
      await result.current.disconnect();
    });

    expect(jest.getTimerCount()).toBe(0);
    expect(result.current.connected).toBe(false);
    expect(result.current.paused).toBe(false);
    expect(harness.transport.closed).toBe(true);
    expect(harness.callsTo("end").map((c) => c.body.sessionId)).toEqual(["session-1"]);

    // The countdown is gone: nothing fires, nothing settles twice, the bar does not come back.
    await advance(WINDOW * 3);
    expect(result.current.paused).toBe(false);
    expect(harness.callsTo("end")).toHaveLength(1);
    unmount();
  });

  test("resume reconnects on the paused thread and restarts the countdown", async () => {
    const { result, unmount } = await liveCall();

    await advance(WINDOW);
    expect(result.current.paused).toBe(true);

    await act(async () => {
      await result.current.resume();
    });

    const mints = harness.callsTo("session");

    expect(mints).toHaveLength(2);
    expect(mints[1]!.body.threadId).toBe(SPEAK_TEST_THREAD_ID);
    // A fresh session on that thread, not a rejoin of the settled one.
    expect(mints[1]!.body.resumeSessionId).toBeUndefined();
    expect(result.current.connected).toBe(true);
    expect(result.current.paused).toBe(false);
    expect(result.current.sessionId).toBe("session-2");
    expect(harness.transports).toHaveLength(2);

    await advance(JUST_UNDER);
    expect(result.current.connected).toBe(true);

    await advance(1);
    expect(result.current.paused).toBe(true);
    unmount();
  });

  test("a failed resume stays paused so the bar can offer another try", async () => {
    restoreFetch();
    harness = createRealtimeVoiceHarness({
      session: (_body, n) =>
        n === 1
          ? {
              clientSecret: "secret",
              sessionId: "session-1",
              model: "gpt-realtime-2.1-mini",
              threadId: SPEAK_TEST_THREAD_ID,
            }
          : speakReply(402, { error: "Speak Realtime budget exceeded" }),
    });
    restoreFetch = harness.install();

    const { result, unmount } = await liveCall();

    await advance(WINDOW);
    await act(async () => {
      await result.current.resume();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.paused).toBe(true);
    expect(result.current.error).toBe("Speak Realtime budget exceeded");
    unmount();
  });

  test("ending a paused call dismisses it without settling the session twice", async () => {
    const { result, unmount } = await liveCall();

    await advance(WINDOW);
    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.paused).toBe(false);
    expect(harness.callsTo("end")).toHaveLength(1);
    unmount();
  });
});

// ---------------------------------------------------------------------------
// Screen context delivery
// ---------------------------------------------------------------------------

describe("sendScreenContext", () => {
  const node = (activeNodeId: string) =>
    ({ kind: "rabbit-hole", id: "00000000-0000-4000-8000-000000000000", activeNodeId }) as const;

  test("sends the body as a silent system item, never a response trigger", async () => {
    restoreFetch();
    harness = createRealtimeVoiceHarness({ context: () => ({ body: "The user opened a page." }) });
    restoreFetch = harness.install();

    const { result, unmount } = await liveCall();

    await act(async () => {
      await result.current.sendScreenContext(node("n2"));
    });

    expect(harness.callsTo("context")[0]!.body.surface).toEqual(node("n2"));
    expect(systemItemTexts(harness.transport)).toHaveLength(1);
    expect(systemItemTexts(harness.transport)[0]).toContain("The user opened a page.");
    expect(harness.transport.sent.some((e) => e.type === "response.create")).toBe(false);
    unmount();
  });

  test("a late reply for a node the user already left is dropped", async () => {
    const replies = { n2: deferred(), n3: deferred() };

    restoreFetch();
    harness = createRealtimeVoiceHarness({
      context: async (body) => {
        const id = (body.surface as { activeNodeId: "n2" | "n3" }).activeNodeId;

        await replies[id].promise;

        return { body: `context for ${id}` };
      },
    });
    restoreFetch = harness.install();

    const { result, unmount } = await liveCall();

    let first!: Promise<void>;
    let second!: Promise<void>;

    act(() => {
      first = result.current.sendScreenContext(node("n2"));
      second = result.current.sendScreenContext(node("n3"));
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

    const texts = systemItemTexts(harness.transport);

    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("context for n3");
    unmount();
  });

  test("does not re-send the surface it last sent", async () => {
    restoreFetch();
    harness = createRealtimeVoiceHarness({ context: () => ({ body: "ctx" }) });
    restoreFetch = harness.install();

    const { result, unmount } = await liveCall();

    await act(async () => {
      await result.current.sendScreenContext(node("n2"));
      await result.current.sendScreenContext(node("n2"));
    });

    expect(harness.callsTo("context")).toHaveLength(1);
    unmount();
  });
});

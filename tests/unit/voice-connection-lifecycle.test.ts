import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import { RealtimeConnectError } from "@/lib/speak/transport/voice-transport";
import {
  createRealtimeVoiceHarness,
  deferred,
  speakReply,
  type RealtimeVoiceHarness,
} from "../helpers/mock-realtime-voice";

let harness: RealtimeVoiceHarness;
let restoreFetch: () => void;

beforeEach(() => {
  jest.useFakeTimers();
  harness = createRealtimeVoiceHarness();
  restoreFetch = harness.install();
});

afterEach(() => {
  cleanup();
  restoreFetch();
  jest.useRealTimers();
});

describe("voice connection lifecycle", () => {
  test("a late mint failure cannot end a newer connection", async () => {
    const firstMint = deferred<unknown>();
    const mintStarted = deferred();
    const mintHarness = createRealtimeVoiceHarness({
      session: (_body, n) => {
        if (n === 1) {
          mintStarted.resolve();

          return firstMint.promise;
        }

        return { sessionId: "new-session", clientSecret: "secret", threadId: null };
      },
    });
    const restore = mintHarness.install();
    const { result } = renderHook(() =>
      useRealtimeVoice({ transportFactory: mintHarness.transportFactory })
    );
    let oldStart!: Promise<void>;

    try {
      await act(async () => {
        oldStart = result.current.connect();
        await mintStarted.promise;
        await result.current.disconnect();
      });
      await act(async () => {
        await result.current.connect();
      });
      await act(async () => {
        firstMint.resolve(speakReply(502, { error: "Failed to mint Realtime session" }));
        await oldStart;
      });

      expect(result.current.connected).toBe(true);
      expect(result.current.sessionId).toBe("new-session");
      expect(result.current.error).toBeNull();
      expect(mintHarness.transport.closed).toBe(false);
      expect(mintHarness.callsTo("end")).toHaveLength(0);
    } finally {
      cleanup();
      restore();
    }
  });

  test("ending during the handshake cannot later mark the call connected", async () => {
    const handshake = deferred();
    const handshakeStarted = deferred();
    const { result } = renderHook(() =>
      useRealtimeVoice({
        transportFactory: () => {
          const transport = harness.transportFactory();
          const connect = transport.connect;

          transport.connect = async (args, events) => {
            await connect(args, events);
            handshakeStarted.resolve();
            await handshake.promise;
          };

          return transport;
        },
      })
    );
    let pending!: Promise<void>;

    await act(async () => {
      pending = result.current.connect();
      await handshakeStarted.promise;
      await result.current.disconnect();
      handshake.resolve();
      await pending;
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.error).toBeNull();
    expect(harness.transport.closed).toBe(true);
    expect(harness.callsTo("end")).toHaveLength(1);
  });

  function retryingVoice() {
    const failed = deferred();
    const hook = renderHook(() =>
      useRealtimeVoice({
        transportFactory: () => {
          const transport = harness.transportFactory();
          const connect = transport.connect;

          transport.connect = async (args, events) => {
            await connect(args, events);
            if (harness.transports.length === 1) {
              failed.resolve();
              throw new RealtimeConnectError(503, "unavailable");
            }
          };

          return transport;
        },
      })
    );

    return { ...hook, failed };
  }

  test("SDP retries still resume once, and callbacks from the failed transport are ignored", async () => {
    const { result, failed } = retryingVoice();
    let pending!: Promise<void>;

    await act(async () => {
      pending = result.current.connect();
      await failed.promise;
    });
    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await pending;
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.sessionId).toBe("session-2");
    expect(harness.callsTo("session")).toHaveLength(2);
    expect(harness.callsTo("session")[1]!.body).toMatchObject({
      resumeSessionId: "session-1",
      withoutThreadContext: true,
      retryAfterConnectFailure: { status: 503, detail: "unavailable" },
    });

    act(() => {
      const oldTransport = harness.transports[0]!;

      oldTransport.emit({ type: "error", error: { message: "old channel failed" } });
      oldTransport.events!.onRemoteStream({} as MediaStream);
      oldTransport.events!.onClosed("old transport closed");
    });

    expect(result.current.error).toBeNull();
    expect(result.current.remoteStream).toBeNull();
    expect(result.current.connected).toBe(true);
    expect(harness.transport.closed).toBe(false);
  });

  test("ending during retry backoff prevents another microphone request and mint", async () => {
    const { result, failed } = retryingVoice();
    let pending!: Promise<void>;

    await act(async () => {
      pending = result.current.connect();
      await failed.promise;
    });
    await act(async () => {
      await result.current.disconnect();
      jest.advanceTimersByTime(1_000);
      await pending;
    });

    expect(harness.transports).toHaveLength(1);
    expect(harness.callsTo("session")).toHaveLength(1);
    expect(harness.callsTo("end")).toHaveLength(1);
    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

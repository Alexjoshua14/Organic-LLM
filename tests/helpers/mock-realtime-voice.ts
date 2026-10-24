import type { VoiceTransport, VoiceTransportEvents } from "@/lib/speak/transport/voice-transport";

import { createFetchResponse } from "./mock-fetch";

import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";

export type FakeVoiceTransport = VoiceTransport & {
  events: VoiceTransportEvents | null;
  closed: boolean;
  /** Every client event the hook sent up the data channel, in order. */
  sent: Array<Record<string, unknown>>;
  /** Deliver a Realtime server event as if it arrived on the data channel. Wrap in `act`. */
  emit(event: Record<string, unknown>): void;
};

export type SpeakRoute =
  | "session"
  | "end"
  | "context"
  | "tool"
  | "transcript"
  | "heartbeat"
  | "active";

export type SpeakFetchCall = {
  route: SpeakRoute | null;
  url: string;
  body: Record<string, unknown>;
};

/** Returns the JSON body; a `{ status, body }` object sets the status too. */
export type SpeakRouteHandler = (
  body: Record<string, unknown>,
  call: number
) => unknown | Promise<unknown>;

export type SpeakReply = { status: number; body: unknown };

export function speakReply(status: number, body: unknown): SpeakReply {
  return { status, body };
}

/** The thread every default mint lands on, so resume assertions have something to match. */
export const SPEAK_TEST_THREAD_ID = "thread-1";

function routeOf(url: string): SpeakRoute | null {
  const match = /\/api\/ai\/speak\/realtime\/([a-z]+)/.exec(url);

  return (match?.[1] as SpeakRoute | undefined) ?? null;
}

/**
 * Stands in for the WebRTC transport and every Speak route the voice hook calls, so the hook and
 * provider run for real above it.
 *
 * Mints number their sessions `session-1`, `session-2`, … on `SPEAK_TEST_THREAD_ID`. Routes without
 * a handler answer `{ ok: true }`; `/active` answers "nothing to resume".
 */
export function createRealtimeVoiceHarness(
  handlers: Partial<Record<SpeakRoute, SpeakRouteHandler>> = {}
) {
  const transports: FakeVoiceTransport[] = [];
  const calls: SpeakFetchCall[] = [];

  const defaults: Record<SpeakRoute, SpeakRouteHandler> = {
    session: (_body, n) => ({
      clientSecret: "secret",
      sessionId: `session-${n}`,
      model: "gpt-realtime-2.1-mini",
      threadId: SPEAK_TEST_THREAD_ID,
      resumed: n > 1,
      modalities: DEFAULT_SPEAK_MODALITIES,
    }),
    active: () => ({ session: null }),
    end: () => ({ ok: true }),
    context: () => ({ body: "" }),
    tool: () => ({ ok: true, modelResult: { ok: true } }),
    transcript: () => ({ ok: true }),
    heartbeat: () => ({ ok: true }),
  };

  const transportFactory = (): FakeVoiceTransport => {
    const transport: FakeVoiceTransport = {
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
      emit(event) {
        transport.events?.onServerEvent(JSON.stringify(event));
      },
    };

    transports.push(transport);

    return transport;
  };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const route = routeOf(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    calls.push({ route, url, body });

    if (!route) return createFetchResponse({ status: 404, body: { error: `Unmocked ${url}` } });

    const n = calls.filter((c) => c.route === route).length;
    const result = await (handlers[route] ?? defaults[route])(body, n);
    const reply =
      result && typeof result === "object" && "status" in result && "body" in result
        ? (result as SpeakReply)
        : { status: 200, body: result };

    return createFetchResponse(reply);
  }) as typeof fetch;

  return {
    transports,
    calls,
    transportFactory,
    /** The most recently created transport — the live call, or the last one. */
    get transport(): FakeVoiceTransport {
      const last = transports.at(-1);

      if (!last) throw new Error("No transport has been created — did the call connect?");

      return last;
    },
    callsTo(route: SpeakRoute): SpeakFetchCall[] {
      return calls.filter((c) => c.route === route);
    },
    /** Replaces `globalThis.fetch`; returns the restore function. */
    install(): () => void {
      const original = globalThis.fetch;

      globalThis.fetch = fetchImpl;

      return () => {
        globalThis.fetch = original;
      };
    },
  };
}

export type RealtimeVoiceHarness = ReturnType<typeof createRealtimeVoiceHarness>;

/** Ambient items the hook pushed on a transport — silent `role: "system"` messages. */
export function systemItemTexts(transport: FakeVoiceTransport): string[] {
  return transport.sent
    .filter((e) => e.type === "conversation.item.create")
    .map((e) => e.item as { role?: string; content?: Array<{ text?: string }> })
    .filter((item) => item.role === "system")
    .map((item) => item.content?.[0]?.text ?? "");
}

/** A promise with its resolver exposed, for holding a route open. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });

  return { promise, resolve };
}

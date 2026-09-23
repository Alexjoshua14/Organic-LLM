"use client";

import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";
import type { SpeakThreadPolicy } from "@/lib/schemas/speak-thread";
import type { SpeakBudgetSnapshot } from "@/lib/speak/types";
import type { SpeakToolClientEffect } from "@/lib/speak/types";
import type { VoiceTransport, VoiceTransportFactory } from "@/lib/speak/transport/voice-transport";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_COMPOSER_MEMORIES } from "@/lib/chat/composer-tool-defaults";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";
import { DEFAULT_SPEAK_THREAD_POLICY } from "@/lib/schemas/speak-thread";
import { screenSurfaceKey } from "@/lib/schemas/speak-screen-context";
import { buildAmbientContextItem } from "@/lib/speak/ambient-item";
import {
  classifyRealtimeEvent,
  sumRealtimeUsage,
  type RealtimeUsage,
} from "@/lib/speak/realtime-events";
import {
  createWebRtcVoiceTransport,
  isRetryableConnectError,
  RealtimeConnectError,
} from "@/lib/speak/transport/voice-transport";
import { createVoiceIdleTimer, SPEAK_IDLE_PAUSE_MS } from "@/lib/speak/voice-idle";
import { SPEAK_TURN_BATCH_MAX, type SpeakVoiceTurn } from "@/lib/speak/voice-turns";

export type LiveVoicePhase = "idle" | "listening" | "thinking" | "speaking";

export type RealtimeTranscriptEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  interim?: boolean;
};

export type ResumedThreadInfo = {
  threadId: string;
  title: string | null;
};

/**
 * Completed turns post to `/transcript` a beat after the assistant finishes, so an exchange
 * lands as a pair. The delay also covers the user's transcription, which Realtime finalises
 * asynchronously and often after the reply has begun. Heartbeat and teardown flush the rest.
 */
const TURN_FLUSH_DEBOUNCE_MS = 2_500;

/**
 * One silent retry when OpenAI 5xxs the SDP exchange. The retry mints a fresh secret that
 * settles the failed session and drops the thread context from the instructions, trading
 * recall for a call that connects. More than one retry would leave the user in dead air.
 */
const CONNECT_RETRY_LIMIT = 1;
const CONNECT_RETRY_DELAY_MS = 600;

type ConnectFailure = { status: number; detail: string };

/** The schemas on `/session` and `/end` cap `detail` at 500 characters. */
function connectFailureOf(error: RealtimeConnectError): ConnectFailure {
  return { status: error.status, detail: error.detail.slice(0, 500) };
}

type SessionMintResponse = {
  clientSecret: string;
  sessionId: string;
  model: string;
  threadId: string | null;
  resumed?: boolean;
  threadTitle?: string | null;
  modalities: SpeakModalities;
  memoryEnabled?: boolean;
  budget?: SpeakBudgetSnapshot;
  /** True when this call continues a session interrupted by a page reload. */
  continued?: boolean;
  /** Continuity anchor for the elapsed clock; survives reloads. */
  startedAt?: number;
  error?: string;
};

/** `GET /api/ai/speak/realtime/active` — a call that outlived the page that started it. */
type ActiveSessionResponse = {
  session: {
    sessionId: string;
    threadId: string | null;
    modalities: SpeakModalities;
    memoryEnabled: boolean;
    startedAt: number;
    expiresAt: number;
  } | null;
};

type HeartbeatResponse = {
  ok?: boolean;
  shouldClose?: boolean;
  error?: string;
  budget?: SpeakBudgetSnapshot;
  session?: { minutesUsed: number; costUsd: number };
};

type ToolResponse = {
  ok?: boolean;
  shouldClose?: boolean;
  error?: string;
  callId?: string | null;
  modelResult?: Record<string, unknown>;
  clientEffects?: SpeakToolClientEffect[];
};

function phaseFromEvents(args: {
  connected: boolean;
  userSpeaking: boolean;
  assistantSpeaking: boolean;
}): LiveVoicePhase {
  if (!args.connected) return "idle";
  if (args.assistantSpeaking) return "speaking";
  if (args.userSpeaking) return "listening";

  return "idle";
}

export function useRealtimeVoice({
  modalities = DEFAULT_SPEAK_MODALITIES,
  memoryEnabled = DEFAULT_COMPOSER_MEMORIES,
  threadPolicy = DEFAULT_SPEAK_THREAD_POLICY,
  onPhaseChange,
  onCaptionChange,
  onClientEffects,
  onBudgetChange,
  transportFactory = createWebRtcVoiceTransport,
  idlePauseMs = SPEAK_IDLE_PAUSE_MS,
}: {
  modalities?: SpeakModalities;
  /** Sent at mint; enables `search_memories` and transcript ingest for the session. */
  memoryEnabled?: boolean;
  /** Default for `connect()`; `startNew()` overrides it with `"new"`. */
  threadPolicy?: SpeakThreadPolicy;
  /** Swap point for a server-side relay; see `lib/speak/transport/voice-transport.ts`. */
  transportFactory?: VoiceTransportFactory;
  /** Quiet stretch before the call pauses itself. Read once, at mount; tests shorten it. */
  idlePauseMs?: number;
  onPhaseChange?: (phase: LiveVoicePhase) => void;
  onCaptionChange?: (caption: {
    role: "user" | "assistant" | "system";
    text: string;
    interim?: boolean;
  }) => void;
  onClientEffects?: (effects: SpeakToolClientEffect[]) => void;
  onBudgetChange?: (budget: SpeakBudgetSnapshot | null) => void;
} = {}) {
  const [phase, setPhase] = useState<LiveVoicePhase>("idle");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [budget, setBudget] = useState<SpeakBudgetSnapshot | null>(null);
  const [transcript, setTranscript] = useState<RealtimeTranscriptEntry[]>([]);
  const [resumedThread, setResumedThread] = useState<ResumedThreadInfo | null>(null);
  /**
   * The idle timer ended the call. The bar stays up offering `resume`; nothing is connected, the
   * mic is released and the server session is settled.
   */
  const [paused, setPaused] = useState(false);
  /**
   * Epoch ms the user started talking, carried across reloads by the server. The live bar's
   * elapsed clock reads this, so a refresh mid-call does not restart the timer at zero.
   */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  /** Mic and model audio, for the waveform's analyser taps. */
  const [streams, setStreams] = useState<{ local: MediaStream | null; remote: MediaStream | null }>(
    { local: null, remote: null }
  );

  const transportRef = useRef<VoiceTransport | null>(null);
  const transportFactoryRef = useRef(transportFactory);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSpeakingRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const connectedRef = useRef(false);
  const modalitiesRef = useRef(modalities);
  const memoryEnabledRef = useRef(memoryEnabled);
  const threadPolicyRef = useRef(threadPolicy);
  /** Usage from `response.done`, accumulated until the next heartbeat carries it. */
  const pendingUsageRef = useRef<RealtimeUsage | null>(null);
  /** Completed turns not yet posted to `/transcript`. */
  const turnBufferRef = useRef<SpeakVoiceTurn[]>([]);
  /** When the current utterances began — transcripts arrive later and out of order. */
  const userSpeechStartedAtRef = useRef<number | null>(null);
  const assistantStartedAtRef = useRef<number | null>(null);
  /** Last surface pushed, so navigating away and back costs nothing. */
  const ambientSurfaceKeyRef = useRef<string | null>(null);
  const threadIdRef = useRef<string | null>(null);
  /** Thread a paused call was writing to, so `resume` lands on it rather than the latest. */
  const pausedThreadIdRef = useRef<string | null>(null);
  const pauseForIdleRef = useRef<() => void>(() => undefined);
  /** See `lib/speak/voice-idle.ts` for what counts as quiet. */
  const [idleTimer] = useState(() =>
    createVoiceIdleTimer({ timeoutMs: idlePauseMs, onIdle: () => pauseForIdleRef.current() })
  );

  modalitiesRef.current = modalities;
  memoryEnabledRef.current = memoryEnabled;
  threadPolicyRef.current = threadPolicy;
  transportFactoryRef.current = transportFactory;

  const setPhaseSafe = useCallback(
    (next: LiveVoicePhase) => {
      setPhase(next);
      onPhaseChange?.(next);
    },
    [onPhaseChange]
  );

  const syncPhase = useCallback(() => {
    setPhaseSafe(
      phaseFromEvents({
        connected: connectedRef.current,
        userSpeaking: userSpeakingRef.current,
        assistantSpeaking: assistantSpeakingRef.current,
      })
    );
  }, [setPhaseSafe]);

  const applyBudget = useCallback(
    (next: SpeakBudgetSnapshot | null | undefined) => {
      if (!next) return;
      setBudget(next);
      onBudgetChange?.(next);
    },
    [onBudgetChange]
  );

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const flushTurns = useCallback(async (opts?: { final?: boolean }) => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    const sid = sessionIdRef.current;
    const batch = turnBufferRef.current.splice(0, SPEAK_TURN_BATCH_MAX);

    if (!sid || batch.length === 0) return;

    const final = opts?.final === true;

    try {
      const res = await fetch("/api/ai/speak/realtime/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, turns: batch, final }),
        // Lets the last flush outlive a closing tab; browsers cap keepalive bodies at 64 KB.
        keepalive: final,
      });

      // 4xx means the session or thread is gone; retrying would not help.
      if (!res.ok && res.status >= 500) {
        turnBufferRef.current.unshift(...batch);
      }
    } catch {
      // Network blip: keep the turns for the next heartbeat or the final flush.
      turnBufferRef.current.unshift(...batch);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);

    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flushTurns();
    }, TURN_FLUSH_DEBOUNCE_MS);
  }, [flushTurns]);

  const teardown = useCallback(
    async (opts?: { notifyServer?: boolean; connectFailure?: ConnectFailure }) => {
      stopHeartbeat();
      idleTimer.stop();

      const sid = sessionIdRef.current;

      // Before `/end` and before the session id is cleared; the fetch is issued synchronously.
      if (sid) {
        void flushTurns({ final: true });
      }

      if (opts?.notifyServer !== false && sid) {
        void fetch("/api/ai/speak/realtime/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, connectFailure: opts?.connectFailure }),
        }).catch(() => undefined);
      }

      transportRef.current?.close();
      transportRef.current = null;

      if (audioElRef.current) {
        audioElRef.current.srcObject = null;
      }

      sessionIdRef.current = null;
      setSessionId(null);
      setStartedAt(null);
      setStreams({ local: null, remote: null });
      connectedRef.current = false;
      setConnected(false);
      setConnecting(false);
      userSpeakingRef.current = false;
      assistantSpeakingRef.current = false;
      userSpeechStartedAtRef.current = null;
      assistantStartedAtRef.current = null;
      ambientSurfaceKeyRef.current = null;
      setPhaseSafe("idle");
    },
    [flushTurns, idleTimer, setPhaseSafe, stopHeartbeat]
  );

  const sendHeartbeat = useCallback(async () => {
    const sid = sessionIdRef.current;

    if (!sid) return;

    void flushTurns();

    const usage = pendingUsageRef.current;

    pendingUsageRef.current = null;

    try {
      const res = await fetch("/api/ai/speak/realtime/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, usage: usage ?? undefined }),
      });
      const data = (await res.json()) as HeartbeatResponse;

      applyBudget(data.budget);

      if (!res.ok || data.shouldClose) {
        setError(data.error ?? "Speak Realtime budget exceeded");
        onCaptionChange?.({
          role: "system",
          text: data.error ?? "Session ended — budget limit reached.",
        });
        await teardown({ notifyServer: false });
      }
    } catch {
      // Transient: carry the unbilled usage into the next tick rather than dropping it.
      pendingUsageRef.current = sumRealtimeUsage(usage, pendingUsageRef.current);
    }
  }, [applyBudget, flushTurns, onCaptionChange, teardown]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      void sendHeartbeat();
    }, 30_000);
  }, [sendHeartbeat, stopHeartbeat]);

  const handleToolCall = useCallback(
    async (call: { call_id?: string; name?: string; arguments?: string }) => {
      const sid = sessionIdRef.current;

      if (!sid || !call.name || !call.call_id) return;

      // A slow tool is the model working, not silence; see `lib/speak/voice-idle.ts`.
      const activity = `tool:${call.call_id}` as const;

      idleTimer.begin(activity);

      try {
        const res = await fetch("/api/ai/speak/realtime/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            callId: call.call_id,
            name: call.name,
            arguments: call.arguments ?? "{}",
          }),
        });
        const data = (await res.json()) as ToolResponse;

        if (data.clientEffects?.length) {
          onClientEffects?.(data.clientEffects);
        }

        if (data.shouldClose) {
          setError(data.error ?? "Budget exceeded");
          await teardown({ notifyServer: false });

          return;
        }

        const transport = transportRef.current;

        if (transport) {
          transport.send({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: call.call_id,
              output: JSON.stringify(data.modelResult ?? { ok: data.ok }),
            },
          });
          transport.send({ type: "response.create" });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tool call failed");
      } finally {
        idleTimer.end(activity);
      }
    },
    [idleTimer, onClientEffects, teardown]
  );

  const handleDataEvent = useCallback(
    (raw: string) => {
      let event: Record<string, unknown>;

      try {
        event = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }

      const ev = classifyRealtimeEvent(event);

      switch (ev.kind) {
        case "user_speech_started":
          idleTimer.begin("user-speech");
          userSpeakingRef.current = true;
          assistantSpeakingRef.current = false;
          userSpeechStartedAtRef.current = Date.now();
          syncPhase();
          onCaptionChange?.({ role: "system", text: "Listening…", interim: true });

          return;
        case "user_speech_stopped":
          idleTimer.end("user-speech");
          userSpeakingRef.current = false;
          syncPhase();

          return;
        case "assistant_started":
          idleTimer.begin("response");
          assistantSpeakingRef.current = true;
          assistantStartedAtRef.current ??= Date.now();
          syncPhase();

          return;
        case "assistant_finished":
          idleTimer.end("response");
          assistantSpeakingRef.current = false;
          pendingUsageRef.current = sumRealtimeUsage(pendingUsageRef.current, ev.usage);
          syncPhase();

          return;
        case "assistant_audio_stopped":
          assistantSpeakingRef.current = false;
          syncPhase();

          return;
        case "assistant_playback_started":
          idleTimer.begin("playback");

          return;
        case "assistant_playback_stopped":
          idleTimer.end("playback");
          assistantSpeakingRef.current = false;
          syncPhase();

          return;
        case "user_transcript": {
          if (!ev.text) return;

          const id = crypto.randomUUID();
          const at = userSpeechStartedAtRef.current ?? Date.now();

          setTranscript((prev) => [...prev, { id, role: "user", text: ev.text }]);
          turnBufferRef.current.push({ id, role: "user", text: ev.text, at });
          onCaptionChange?.({ role: "user", text: ev.text });

          return;
        }
        case "assistant_transcript_delta":
          if (ev.delta) {
            onCaptionChange?.({ role: "assistant", text: ev.delta, interim: true });
          }

          return;
        case "assistant_transcript": {
          const at = assistantStartedAtRef.current ?? Date.now();

          assistantStartedAtRef.current = null;

          if (!ev.text) return;

          const id = crypto.randomUUID();

          setTranscript((prev) => [...prev, { id, role: "assistant", text: ev.text }]);
          turnBufferRef.current.push({ id, role: "assistant", text: ev.text, at });
          onCaptionChange?.({ role: "assistant", text: ev.text });
          scheduleFlush();

          return;
        }
        case "tool_call":
          if (ev.name === "search_memories") {
            // Locked principle 2 (docs/speak/tool-behavior.md): a caption, never a spoken
            // "let me check" — and shown at call start so it costs no round-trip.
            onCaptionChange?.({ role: "system", text: "Recalling…", interim: true });
          }

          void handleToolCall({ call_id: ev.callId, name: ev.name, arguments: ev.args });

          return;
        case "error":
          setError(ev.message);

          return;
        default:
          return;
      }
    },
    [handleToolCall, idleTimer, onCaptionChange, scheduleFlush, syncPhase]
  );

  const connect = useCallback(
    async (options?: {
      threadPolicy?: SpeakThreadPolicy;
      resumeSessionId?: string;
      /** Continue this thread whatever the policy says; the session route checks ownership. */
      threadId?: string;
    }) => {
      if (connecting || connectedRef.current) return;

      setConnecting(true);
      setError(null);

      // A retry resumes the attempt that failed: that settles its record, frees the concurrency
      // slot it holds, and keeps its thread and clock.
      let resumeSessionId = options?.resumeSessionId;
      let retryFailure: ConnectFailure | null = null;

      try {
        let mint: SessionMintResponse;
        let transport: VoiceTransport;

        for (let attempt = 0; ; attempt++) {
          const mintRes = await fetch("/api/ai/speak/realtime/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modalities: modalitiesRef.current,
              memory: memoryEnabledRef.current,
              threadPolicy: options?.threadPolicy ?? threadPolicyRef.current,
              threadId: options?.threadId,
              resumeSessionId,
              retryAfterConnectFailure: retryFailure ?? undefined,
              withoutThreadContext: retryFailure ? true : undefined,
            }),
          });

          mint = (await mintRes.json()) as SessionMintResponse;

          if (!mintRes.ok || !mint.clientSecret || !mint.sessionId) {
            throw new Error(mint.error ?? "Failed to start Realtime session");
          }

          applyBudget(mint.budget);
          sessionIdRef.current = mint.sessionId;
          setSessionId(mint.sessionId);
          threadIdRef.current = mint.threadId;
          setThreadId(mint.threadId);
          setStartedAt(mint.startedAt ?? Date.now());
          setResumedThread(
            mint.resumed && mint.threadId
              ? { threadId: mint.threadId, title: mint.threadTitle ?? null }
              : null
          );
          turnBufferRef.current = [];
          pendingUsageRef.current = null;
          ambientSurfaceKeyRef.current = null;

          const audioEl = audioElRef.current ?? document.createElement("audio");

          audioEl.autoplay = true;
          audioElRef.current = audioEl;

          transport = transportFactoryRef.current();
          transportRef.current = transport;

          try {
            await transport.connect(
              { clientSecret: mint.clientSecret },
              {
                onServerEvent: handleDataEvent,
                onRemoteStream: (stream) => {
                  audioEl.srcObject = stream;
                  setStreams((prev) => ({ ...prev, remote: stream }));
                },
                onClosed: (reason) => {
                  setError(reason);
                  void teardown({ notifyServer: true });
                },
              }
            );
            break;
          } catch (err) {
            if (attempt >= CONNECT_RETRY_LIMIT || !isRetryableConnectError(err)) throw err;

            transport.close();
            transportRef.current = null;
            retryFailure = connectFailureOf(err);
            resumeSessionId = mint.sessionId;
            await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
          }
        }

        setStreams({ local: transport.localStream, remote: transport.remoteStream });

        connectedRef.current = true;
        setConnected(true);
        setConnecting(false);
        setPaused(false);
        setPhaseSafe("idle");
        onCaptionChange?.({
          role: "system",
          text: options?.resumeSessionId
            ? "Reconnected — still here."
            : mint.resumed && !retryFailure
              ? "Connected — picking up where you left off."
              : "Connected — speak naturally. Tap End to hang up.",
        });
        startHeartbeat();
        idleTimer.reset();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to connect";

        setError(msg);
        setConnecting(false);
        await teardown({
          notifyServer: true,
          connectFailure: err instanceof RealtimeConnectError ? connectFailureOf(err) : undefined,
        });
        onCaptionChange?.({ role: "system", text: msg });
      }
    },
    [
      applyBudget,
      connecting,
      handleDataEvent,
      idleTimer,
      onCaptionChange,
      setPhaseSafe,
      startHeartbeat,
      teardown,
    ]
  );

  /**
   * The idle timer's action. Ends the call — settling the server session, releasing the mic and
   * the concurrency slot — but keeps the bar up and the thread in hand, so `resume` continues
   * the same conversation. Nothing bills while paused.
   */
  const pauseForIdle = useCallback(async () => {
    if (!connectedRef.current) return;

    pausedThreadIdRef.current = threadIdRef.current;
    // Set alongside teardown's state so no render sees "disconnected and not paused" — that
    // frame would start the bar's exit animation. A stale error would read as a failed resume.
    setPaused(true);
    setError(null);
    await teardown({ notifyServer: true });
    onCaptionChange?.({ role: "system", text: "Paused after a quiet stretch — resume anytime." });
  }, [onCaptionChange, teardown]);

  pauseForIdleRef.current = () => void pauseForIdle();

  /**
   * Picks a paused call back up on the thread it was writing to. The mint rehydrates it through
   * the resume preamble (summary plus recent turns), the same path as any resumed thread. A
   * failure leaves the call paused, so the bar still offers another try.
   */
  const resume = useCallback(
    () => connect({ threadId: pausedThreadIdRef.current ?? undefined }),
    [connect]
  );

  /** Fresh thread regardless of the hook's default policy. */
  const startNew = useCallback(() => connect({ threadPolicy: "new" }), [connect]);

  /**
   * Rejoins a call that outlived the page. A reload kills the peer connection but not the server
   * session, so without this the user is silently dropped mid-conversation with a billing record
   * still ticking. Mints a *new* call against the same thread and clock; there is roughly a
   * second of dead air while ICE completes, and no new mic permission prompt.
   *
   * Returns whether a session was found, so the caller can distinguish "nothing to do" from
   * "tried and failed".
   */
  const resumeIfActive = useCallback(async (): Promise<boolean> => {
    if (connectedRef.current || connecting) return false;

    try {
      const res = await fetch("/api/ai/speak/realtime/active");

      if (!res.ok) return false;

      const data = (await res.json()) as ActiveSessionResponse;

      if (!data.session) return false;

      await connect({ resumeSessionId: data.session.sessionId });

      return true;
    } catch {
      // Offline or the route is unreachable: stay idle rather than surfacing an error the user
      // did not ask for. They can always start a session by hand.
      return false;
    }
  }, [connect, connecting]);

  /**
   * Tells the model what the user is now looking at, as a silent system item.
   *
   * The body is assembled server-side (summaries and compiled docs need privileged reads), then
   * forwarded down the data channel from here because the channel lives in the browser. No
   * `response.create` follows — see `lib/speak/ambient-item.ts` for why that makes it silent.
   */
  const sendScreenContext = useCallback(async (surface: SpeakScreenSurface) => {
    const sid = sessionIdRef.current;
    const transport = transportRef.current;

    if (!sid || !transport || !connectedRef.current) return;

    const key = screenSurfaceKey(surface);

    if (ambientSurfaceKeyRef.current === key) return;

    // Claim the key before awaiting so a fast double-navigation cannot push twice.
    ambientSurfaceKeyRef.current = key;

    try {
      const res = await fetch("/api/ai/speak/realtime/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, surface }),
      });

      if (!res.ok) {
        if (ambientSurfaceKeyRef.current === key) ambientSurfaceKeyRef.current = null;

        return;
      }

      const data = (await res.json()) as { body?: string };
      const item = buildAmbientContextItem(data.body ?? "");

      // A newer surface claimed the key while this was in flight — clicking through rabbit-hole
      // nodes does it constantly — so a late reply would overwrite fresher context. The session
      // can also end between the request and the response.
      if (
        item &&
        ambientSurfaceKeyRef.current === key &&
        transportRef.current === transport &&
        connectedRef.current
      ) {
        transport.send(item);
      }
    } catch {
      // Ambient awareness is an enhancement; a failed push must never disturb the call.
      if (ambientSurfaceKeyRef.current === key) ambientSurfaceKeyRef.current = null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    setPaused(false);
    await teardown({ notifyServer: true });
    onCaptionChange?.({ role: "system", text: "Session ended." });
  }, [onCaptionChange, teardown]);

  const resetSession = useCallback(async () => {
    setPaused(false);
    await teardown({ notifyServer: true });
    turnBufferRef.current = [];
    setTranscript([]);
    setResumedThread(null);
    setError(null);
    setBudget(null);
    onBudgetChange?.(null);
    onCaptionChange?.({ role: "system", text: "" });
  }, [onBudgetChange, onCaptionChange, teardown]);

  useEffect(() => {
    return () => {
      void teardown({ notifyServer: true });
    };
  }, [teardown]);

  return {
    phase,
    connected,
    connecting,
    /** Ended by the idle timer; `resume` continues it. See `lib/speak/voice-idle.ts`. */
    paused,
    error,
    sessionId,
    threadId,
    resumedThread,
    budget,
    transcript,
    /** Epoch ms the conversation began, across reloads. `null` when idle. */
    startedAt,
    /** Mic and model audio for the live bar's waveform analyser. */
    localStream: streams.local,
    remoteStream: streams.remote,
    connect,
    startNew,
    resume,
    resumeIfActive,
    sendScreenContext,
    disconnect,
    resetSession,
    setAudioElement: (el: HTMLAudioElement | null) => {
      audioElRef.current = el;
    },
  };
}

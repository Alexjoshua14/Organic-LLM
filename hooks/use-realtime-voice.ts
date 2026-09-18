"use client";

import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakThreadPolicy } from "@/lib/schemas/speak-thread";
import type { SpeakBudgetSnapshot } from "@/lib/speak/types";
import type { SpeakToolClientEffect } from "@/lib/speak/types";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_COMPOSER_MEMORIES } from "@/lib/chat/composer-tool-defaults";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";
import { DEFAULT_SPEAK_THREAD_POLICY } from "@/lib/schemas/speak-thread";
import {
  classifyRealtimeEvent,
  sumRealtimeUsage,
  type RealtimeUsage,
} from "@/lib/speak/realtime-events";
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
  error?: string;
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
}: {
  modalities?: SpeakModalities;
  /** Sent at mint; enables `search_memories` and transcript ingest for the session. */
  memoryEnabled?: boolean;
  /** Default for `connect()`; `startNew()` overrides it with `"new"`. */
  threadPolicy?: SpeakThreadPolicy;
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
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

  modalitiesRef.current = modalities;
  memoryEnabledRef.current = memoryEnabled;
  threadPolicyRef.current = threadPolicy;

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
    async (opts?: { notifyServer?: boolean }) => {
      stopHeartbeat();

      const sid = sessionIdRef.current;

      // Before `/end` and before the session id is cleared; the fetch is issued synchronously.
      if (sid) {
        void flushTurns({ final: true });
      }

      if (opts?.notifyServer !== false && sid) {
        void fetch("/api/ai/speak/realtime/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        }).catch(() => undefined);
      }

      try {
        dcRef.current?.close();
      } catch {
        /* ignore */
      }
      dcRef.current = null;

      try {
        pcRef.current?.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;

      if (audioElRef.current) {
        audioElRef.current.srcObject = null;
      }

      sessionIdRef.current = null;
      setSessionId(null);
      connectedRef.current = false;
      setConnected(false);
      setConnecting(false);
      userSpeakingRef.current = false;
      assistantSpeakingRef.current = false;
      userSpeechStartedAtRef.current = null;
      assistantStartedAtRef.current = null;
      setPhaseSafe("idle");
    },
    [flushTurns, setPhaseSafe, stopHeartbeat]
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

        const dc = dcRef.current;

        if (dc && dc.readyState === "open") {
          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: call.call_id,
                output: JSON.stringify(data.modelResult ?? { ok: data.ok }),
              },
            })
          );
          dc.send(JSON.stringify({ type: "response.create" }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tool call failed");
      }
    },
    [onClientEffects, teardown]
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
          userSpeakingRef.current = true;
          assistantSpeakingRef.current = false;
          userSpeechStartedAtRef.current = Date.now();
          syncPhase();
          onCaptionChange?.({ role: "system", text: "Listening…", interim: true });

          return;
        case "user_speech_stopped":
          userSpeakingRef.current = false;
          syncPhase();

          return;
        case "assistant_started":
          assistantSpeakingRef.current = true;
          assistantStartedAtRef.current ??= Date.now();
          syncPhase();

          return;
        case "assistant_finished":
          assistantSpeakingRef.current = false;
          pendingUsageRef.current = sumRealtimeUsage(pendingUsageRef.current, ev.usage);
          syncPhase();

          return;
        case "assistant_audio_stopped":
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
    [handleToolCall, onCaptionChange, scheduleFlush, syncPhase]
  );

  const connect = useCallback(
    async (options?: { threadPolicy?: SpeakThreadPolicy }) => {
      if (connecting || connectedRef.current) return;

      setConnecting(true);
      setError(null);

      try {
        const mintRes = await fetch("/api/ai/speak/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modalities: modalitiesRef.current,
            memory: memoryEnabledRef.current,
            threadPolicy: options?.threadPolicy ?? threadPolicyRef.current,
          }),
        });
        const mint = (await mintRes.json()) as SessionMintResponse;

        if (!mintRes.ok || !mint.clientSecret || !mint.sessionId) {
          throw new Error(mint.error ?? "Failed to start Realtime session");
        }

        applyBudget(mint.budget);
        sessionIdRef.current = mint.sessionId;
        setSessionId(mint.sessionId);
        setThreadId(mint.threadId);
        setResumedThread(
          mint.resumed && mint.threadId
            ? { threadId: mint.threadId, title: mint.threadTitle ?? null }
            : null
        );
        turnBufferRef.current = [];
        pendingUsageRef.current = null;

        const pc = new RTCPeerConnection();

        pcRef.current = pc;

        const audioEl = audioElRef.current ?? document.createElement("audio");

        audioEl.autoplay = true;
        audioElRef.current = audioEl;

        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0] ?? null;
        };

        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });

        localStreamRef.current = ms;
        pc.addTrack(ms.getTracks()[0]!);

        const dc = pc.createDataChannel("oai-events");

        dcRef.current = dc;
        dc.addEventListener("message", (ev) => {
          if (typeof ev.data === "string") handleDataEvent(ev.data);
        });

        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${mint.clientSecret}`,
            "Content-Type": "application/sdp",
          },
        });

        if (!sdpRes.ok) {
          const errText = await sdpRes.text().catch(() => "");

          throw new Error(`Realtime connect failed (${sdpRes.status}): ${errText}`);
        }

        const answer: RTCSessionDescriptionInit = {
          type: "answer",
          sdp: await sdpRes.text(),
        };

        await pc.setRemoteDescription(answer);

        connectedRef.current = true;
        setConnected(true);
        setConnecting(false);
        setPhaseSafe("idle");
        onCaptionChange?.({
          role: "system",
          text: mint.resumed
            ? "Connected — picking up where you left off."
            : "Connected — speak naturally. Tap End to hang up.",
        });
        startHeartbeat();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to connect";

        setError(msg);
        setConnecting(false);
        await teardown({ notifyServer: true });
        onCaptionChange?.({ role: "system", text: msg });
      }
    },
    [
      applyBudget,
      connecting,
      handleDataEvent,
      onCaptionChange,
      setPhaseSafe,
      startHeartbeat,
      teardown,
    ]
  );

  /** Fresh thread regardless of the hook's default policy. */
  const startNew = useCallback(() => connect({ threadPolicy: "new" }), [connect]);

  const disconnect = useCallback(async () => {
    await teardown({ notifyServer: true });
    onCaptionChange?.({ role: "system", text: "Session ended." });
  }, [onCaptionChange, teardown]);

  const resetSession = useCallback(async () => {
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
    error,
    sessionId,
    threadId,
    resumedThread,
    budget,
    transcript,
    connect,
    startNew,
    disconnect,
    resetSession,
    setAudioElement: (el: HTMLAudioElement | null) => {
      audioElRef.current = el;
    },
  };
}

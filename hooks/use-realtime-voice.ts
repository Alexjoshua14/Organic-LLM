"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakBudgetSnapshot } from "@/lib/speak/types";
import type { SpeakToolClientEffect } from "@/lib/speak/types";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";

export type LiveVoicePhase = "idle" | "listening" | "thinking" | "speaking";

export type RealtimeTranscriptEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  interim?: boolean;
};

type SessionMintResponse = {
  clientSecret: string;
  sessionId: string;
  model: string;
  threadId: string | null;
  modalities: SpeakModalities;
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
  onPhaseChange,
  onCaptionChange,
  onClientEffects,
  onBudgetChange,
}: {
  modalities?: SpeakModalities;
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatAtRef = useRef<number>(0);
  const userSpeakingRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const connectedRef = useRef(false);
  const modalitiesRef = useRef(modalities);

  modalitiesRef.current = modalities;

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

  const teardown = useCallback(
    async (opts?: { notifyServer?: boolean }) => {
      stopHeartbeat();

      const sid = sessionIdRef.current;

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
      setPhaseSafe("idle");
    },
    [setPhaseSafe, stopHeartbeat]
  );

  const sendHeartbeat = useCallback(async () => {
    const sid = sessionIdRef.current;

    if (!sid) return;

    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - lastHeartbeatAtRef.current) / 1000);

    lastHeartbeatAtRef.current = now;

    try {
      const res = await fetch("/api/ai/speak/realtime/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, elapsedSeconds }),
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
      /* transient — next tick retries */
    }
  }, [applyBudget, onCaptionChange, teardown]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    lastHeartbeatAtRef.current = Date.now();
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

      const type = String(event.type ?? "");

      if (type === "input_audio_buffer.speech_started") {
        userSpeakingRef.current = true;
        assistantSpeakingRef.current = false;
        syncPhase();
        onCaptionChange?.({ role: "system", text: "Listening…", interim: true });

        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        userSpeakingRef.current = false;
        syncPhase();

        return;
      }

      if (type === "response.created" || type === "response.output_audio.delta") {
        assistantSpeakingRef.current = true;
        syncPhase();

        return;
      }

      if (
        type === "response.done" ||
        type === "response.output_audio.done" ||
        type === "output_audio_buffer.stopped"
      ) {
        assistantSpeakingRef.current = false;
        syncPhase();

        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const text = String(event.transcript ?? "").trim();

        if (text) {
          setTranscript((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", text },
          ]);
          onCaptionChange?.({ role: "user", text });
        }

        return;
      }

      if (type === "response.audio_transcript.delta") {
        const delta = String(event.delta ?? "");

        if (delta) {
          onCaptionChange?.({ role: "assistant", text: delta, interim: true });
        }

        return;
      }

      if (type === "response.audio_transcript.done") {
        const text = String(event.transcript ?? "").trim();

        if (text) {
          setTranscript((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", text },
          ]);
          onCaptionChange?.({ role: "assistant", text });
        }

        return;
      }

      if (type === "response.function_call_arguments.done") {
        void handleToolCall({
          call_id: typeof event.call_id === "string" ? event.call_id : undefined,
          name: typeof event.name === "string" ? event.name : undefined,
          arguments: typeof event.arguments === "string" ? event.arguments : "{}",
        });
      }
    },
    [handleToolCall, onCaptionChange, syncPhase]
  );

  const connect = useCallback(async () => {
    if (connecting || connectedRef.current) return;

    setConnecting(true);
    setError(null);

    try {
      const mintRes = await fetch("/api/ai/speak/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalities: modalitiesRef.current, createThread: true }),
      });
      const mint = (await mintRes.json()) as SessionMintResponse;

      if (!mintRes.ok || !mint.clientSecret || !mint.sessionId) {
        throw new Error(mint.error ?? "Failed to start Realtime session");
      }

      applyBudget(mint.budget);
      sessionIdRef.current = mint.sessionId;
      setSessionId(mint.sessionId);
      setThreadId(mint.threadId);

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
        text: "Connected — speak naturally. Tap End to hang up.",
      });
      startHeartbeat();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";

      setError(msg);
      setConnecting(false);
      await teardown({ notifyServer: true });
      onCaptionChange?.({ role: "system", text: msg });
    }
  }, [
    applyBudget,
    connecting,
    handleDataEvent,
    onCaptionChange,
    setPhaseSafe,
    startHeartbeat,
    teardown,
  ]);

  const disconnect = useCallback(async () => {
    await teardown({ notifyServer: true });
    onCaptionChange?.({ role: "system", text: "Session ended." });
  }, [onCaptionChange, teardown]);

  const resetSession = useCallback(async () => {
    await teardown({ notifyServer: true });
    setTranscript([]);
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
    budget,
    transcript,
    connect,
    disconnect,
    resetSession,
    setAudioElement: (el: HTMLAudioElement | null) => {
      audioElRef.current = el;
    },
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getWebSpeechRecognitionCtor, type WebSpeechRecognition } from "@/lib/web-speech-recognition";

export type LiveVoicePhase = "idle" | "listening" | "thinking" | "speaking";

export type LiveVoiceTurn = {
  role: "user" | "assistant";
  content: string;
};

export function useLiveVoice({
  onPhaseChange,
  onCaptionChange,
}: {
  onPhaseChange?: (phase: LiveVoicePhase) => void;
  onCaptionChange?: (caption: { role: "user" | "assistant" | "system"; text: string; interim?: boolean }) => void;
} = {}) {
  const [phase, setPhase] = useState<LiveVoicePhase>("idle");
  const [history, setHistory] = useState<LiveVoiceTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const interimRef = useRef("");
  const phaseRef = useRef<LiveVoicePhase>("idle");

  const setPhaseSafe = useCallback(
    (next: LiveVoicePhase) => {
      phaseRef.current = next;
      setPhase(next);
      onPhaseChange?.(next);
    },
    [onPhaseChange]
  );

  useEffect(() => {
    const Ctor = getWebSpeechRecognitionCtor();

    if (!Ctor) return;

    const recognition = new Ctor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        interimRef.current = interim;
        onCaptionChange?.({ role: "user", text: interim, interim: true });
      }

      if (finalText.trim()) {
        interimRef.current = finalText.trim();
        onCaptionChange?.({ role: "user", text: finalText.trim(), interim: false });
      }
    };

    recognition.onerror = () => {
      setPhaseSafe("idle");
    };

    recognition.onend = () => {
      if (phaseRef.current === "listening") {
        setPhaseSafe("idle");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onCaptionChange, setPhaseSafe]);

  const startListening = useCallback(() => {
    setError(null);
    interimRef.current = "";

    if (!recognitionRef.current) {
      setError("Speech recognition is not available in this browser.");

      return;
    }

    try {
      recognitionRef.current.start();
      setPhaseSafe("listening");
      onCaptionChange?.({ role: "system", text: "Listening…" });
    } catch {
      setError("Could not start microphone.");
    }
  }, [onCaptionChange, setPhaseSafe]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const submitTranscript = useCallback(
    async (transcript: string) => {
      const message = transcript.trim();

      if (!message) {
        setPhaseSafe("idle");
        onCaptionChange?.({ role: "system", text: "" });

        return;
      }

      setPhaseSafe("thinking");
      onCaptionChange?.({ role: "user", text: message });
      setError(null);

      const nextHistory: LiveVoiceTurn[] = [...history, { role: "user", content: message }];

      try {
        const res = await fetch("/api/ai/speak/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
        });

        const data = (await res.json()) as { text?: string; error?: string };

        if (!res.ok || !data.text) {
          throw new Error(data.error ?? "Voice turn failed");
        }

        const assistantText = data.text.trim();

        setHistory([...nextHistory, { role: "assistant", content: assistantText }]);
        onCaptionChange?.({ role: "assistant", text: assistantText });

        return assistantText;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Voice turn failed";

        setError(msg);
        setPhaseSafe("idle");
        onCaptionChange?.({ role: "system", text: msg });

        return null;
      }
    },
    [history, onCaptionChange, setPhaseSafe]
  );

  const endTurn = useCallback(
    async () => {
      stopListening();

      const transcript = interimRef.current.trim();

      return submitTranscript(transcript);
    },
    [stopListening, submitTranscript]
  );

  const resetSession = useCallback(() => {
    stopListening();
    setHistory([]);
    setError(null);
    interimRef.current = "";
    setPhaseSafe("idle");
    onCaptionChange?.({ role: "system", text: "" });
  }, [onCaptionChange, setPhaseSafe, stopListening]);

  const markSpeaking = useCallback(() => {
    setPhaseSafe("speaking");
  }, [setPhaseSafe]);

  const markIdle = useCallback(() => {
    setPhaseSafe("idle");
  }, [setPhaseSafe]);

  return {
    phase,
    history,
    error,
    isListening: phase === "listening",
    startListening,
    stopListening,
    endTurn,
    submitTranscript,
    resetSession,
    markSpeaking,
    markIdle,
    speechAvailable: typeof window !== "undefined" && Boolean(getWebSpeechRecognitionCtor()),
  };
}

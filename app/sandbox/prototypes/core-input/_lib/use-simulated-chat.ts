"use client";

import type { ChatStatus } from "ai";
import type { LabSendOutcome } from "./lab-state";

import { useCallback, useEffect, useRef, useState } from "react";

/** Simulated round trip after a lab send: submitted → streaming → ready (or error). */
export const SIMULATED_SEND_TIMELINE = {
  submittedMs: 700,
  streamingMs: 2600,
} as const;

export const SIMULATED_ERROR_MESSAGE = "Simulated send failure (lab)";

export type LabSendRecord = {
  kind: "send" | "steer";
  text: string;
  fileCount: number;
  at: number;
};

type LabSendMessage = {
  text?: string;
  files?: unknown[];
};

export type SimulatedChat = {
  status: ChatStatus;
  error: Error | undefined;
  lastSend: LabSendRecord | null;
  /** Pin a status directly; cancels any timeline in flight. */
  setStatus: (status: ChatStatus) => void;
  sendMessage: (message?: LabSendMessage) => Promise<void>;
  stop: () => Promise<void>;
  clearError: () => void;
  recordSteer: (text: string) => void;
};

/**
 * Stand-in for `useChat` state so the composer's own status handling runs for real:
 * submit/stop buttons, sent-text shimmer, and the restore-draft-on-error path.
 */
export function useSimulatedChat({ outcome }: { outcome: LabSendOutcome }): SimulatedChat {
  const [status, setStatusState] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>(undefined);
  const [lastSend, setLastSend] = useState<LabSendRecord | null>(null);
  const timersRef = useRef<number[]>([]);
  const outcomeRef = useRef(outcome);

  outcomeRef.current = outcome;

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const setStatus = useCallback(
    (next: ChatStatus) => {
      clearTimers();
      setError(next === "error" ? new Error(SIMULATED_ERROR_MESSAGE) : undefined);
      setStatusState(next);
    },
    [clearTimers]
  );

  const sendMessage = useCallback(
    async (message?: LabSendMessage) => {
      clearTimers();
      setLastSend({
        kind: "send",
        text: message?.text ?? "",
        fileCount: message?.files?.length ?? 0,
        at: Date.now(),
      });
      setError(undefined);
      setStatusState("submitted");

      timersRef.current.push(
        window.setTimeout(() => {
          setStatusState("streaming");

          timersRef.current.push(
            window.setTimeout(() => {
              if (outcomeRef.current === "error") {
                setError(new Error(SIMULATED_ERROR_MESSAGE));
                setStatusState("error");
              } else {
                setStatusState("ready");
              }
            }, SIMULATED_SEND_TIMELINE.streamingMs)
          );
        }, SIMULATED_SEND_TIMELINE.submittedMs)
      );
    },
    [clearTimers]
  );

  const stop = useCallback(async () => {
    clearTimers();
    setStatusState("ready");
  }, [clearTimers]);

  // Mirrors the AI SDK: clearing the error also returns the chat to ready.
  const clearError = useCallback(() => {
    setError(undefined);
    setStatusState("ready");
  }, []);

  const recordSteer = useCallback((text: string) => {
    setLastSend({ kind: "steer", text, fileCount: 0, at: Date.now() });
  }, []);

  return { status, error, lastSend, setStatus, sendMessage, stop, clearError, recordSteer };
}

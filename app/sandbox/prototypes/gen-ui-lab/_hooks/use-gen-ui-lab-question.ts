"use client";

import type { UIMessage } from "ai";
import type { CoreInputScope } from "@/lib/core-input/scopes";
import type { GenUiLabApiResponse } from "@/lib/sandbox/gen-ui-lab";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { coreInputSnapshots } from "@/lib/core-input/snapshot-store";

type LabQuestionParams = {
  request: (question: string, signal: AbortSignal) => Promise<GenUiLabApiResponse>;
  onResponse: (response: GenUiLabApiResponse) => void;
};

/** The lab has no saved thread: each opening owns only a disposable question and its settings. */
export function useGenUiLabQuestion({ request, onResponse }: LabQuestionParams) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "submitted" | "error">("ready");
  const [error, setError] = useState<Error | undefined>();
  const sessionRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  const dispose = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    if (sessionRef.current) coreInputSnapshots.clearEphemeral(sessionRef.current);
    sessionRef.current = null;
  }, []);

  useEffect(() => dispose, [dispose]);

  const open = useCallback(() => {
    if (sessionRef.current) return;
    const id = `gen-ui-lab:btw:${++sequence.current}`;

    sessionRef.current = id;
    setSessionId(id);
    setMessages([]);
    setError(undefined);
    setStatus("ready");
  }, []);

  const close = useCallback(() => {
    dispose();
    setSessionId(null);
    setMessages([]);
    setError(undefined);
    setStatus("ready");
  }, [dispose]);

  const stop = useCallback(async () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setStatus("ready");
  }, []);

  const clearError = useCallback(() => {
    setError(undefined);
    setStatus("ready");
  }, []);

  const sendQuestion = useCallback(
    async (question: string) => {
      const text = question.trim();
      const session = sessionRef.current;

      if (!text || !session) return;
      requestRef.current?.abort();
      const controller = new AbortController();

      requestRef.current = controller;
      setMessages([{ id: `${session}:question`, role: "user", parts: [{ type: "text", text }] }]);
      setError(undefined);
      setStatus("submitted");

      try {
        const response = await request(text, controller.signal);

        if (controller.signal.aborted || sessionRef.current !== session) return;
        onResponse(response);
        setMessages((previous) => [
          ...previous,
          {
            id: `${session}:answer`,
            role: "assistant",
            parts: [{ type: "text", text: response.message }],
          },
        ]);
        setStatus("ready");
      } catch (cause) {
        if (controller.signal.aborted || sessionRef.current !== session) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus("error");
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    },
    [request, onResponse]
  );

  const scope = useMemo<CoreInputScope | undefined>(
    () =>
      sessionId
        ? {
            key: sessionId,
            inheritFrom: ["gen-ui-lab"],
            ephemeral: true,
          }
        : undefined,
    [sessionId]
  );

  return {
    sessionId,
    isOpen: sessionId !== null,
    messages,
    status,
    error,
    scope,
    open,
    close,
    stop,
    clearError,
    sendQuestion,
  };
}

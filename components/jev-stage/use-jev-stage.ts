"use client";

import type { StageController } from "@/components/stage/stage";
import type { StageOperation, StageTurnSettings } from "@/lib/stage/schema";
import type { JevStageBundle, JevStageStreamEvent, JevStageTurnInsight } from "@/lib/jev-stage/schema";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { stageRequest, StageRequestError } from "@/components/stage/use-stage";
import { applyStageOperations, stageReservedRects } from "@/lib/stage/layout";
import { emptyStageState } from "@/lib/stage/schema";
import { emptyJevStageBundle } from "@/lib/jev-stage/schema";

async function readNdjson(
  response: Response,
  onEvent: (event: JevStageStreamEvent) => void
): Promise<void> {
  if (!response.body) throw new Error("No stream body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;
      onEvent(JSON.parse(trimmed) as JevStageStreamEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer.trim()) as JevStageStreamEvent);
}

export function useJevStage(): StageController & {
  insights: JevStageTurnInsight[];
  streamingText: string;
  setEval: (
    turnId: string,
    signal: "up" | "down",
    note?: string | null
  ) => Promise<void>;
} {
  const [bundle, setBundle] = useState<JevStageBundle>(emptyJevStageBundle);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const current = useRef(bundle);
  const sendLock = useRef(false);
  const mounted = useRef(true);

  current.current = bundle;

  const accept = useCallback((next: JevStageBundle) => {
    if (!mounted.current) return;
    current.current = next;
    setBundle(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await stageRequest<JevStageBundle>("/api/prototypes/jev-stage");

      accept(data);
      if (mounted.current) setError(null);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof StageRequestError && cause.status === 401
            ? "Sign in with lab access to open Jev Stage."
            : cause instanceof Error
              ? cause.message
              : "Couldn’t load Jev Stage."
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
    };
  }, [load]);

  const send = useCallback(
    async (message: string, settings?: StageTurnSettings) => {
      if (sendLock.current) return false;
      sendLock.current = true;
      setSending(true);
      setError(null);
      setStreamingText("");
      const requestId = crypto.randomUUID();

      try {
        const response = await fetch("/api/prototypes/jev-stage", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, requestId, settings }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);

          throw new StageRequestError(data?.error ?? "Turn failed", response.status);
        }

        await readNdjson(response, (event) => {
          if (!mounted.current) return;
          if (event.type === "delta") {
            setStreamingText((value) => value + event.text);
          } else if (event.type === "patch" || event.type === "done") {
            accept({
              stage: event.type === "done" ? event.stage : event.stage,
              insights:
                event.type === "done"
                  ? [...current.current.insights.filter((i) => i.turnId !== event.insight.turnId), event.insight]
                  : current.current.insights,
            });
          } else if (event.type === "limit_error" || event.type === "error") {
            setError(event.message);
          }
        });
        setStreamingText("");

        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Your message couldn’t be sent.");

        return false;
      } finally {
        sendLock.current = false;
        if (mounted.current) setSending(false);
      }
    },
    [accept]
  );

  const mutate = useCallback(
    async (operations: StageOperation[]) => {
      setSaving(true);
      try {
        const previous = current.current.stage;
        const nextStage = {
          ...previous,
          revision: previous.revision + 1,
          widgets: applyStageOperations(
            previous.widgets,
            operations,
            stageReservedRects(previous)
          ),
        };
        const next = { ...current.current, stage: nextStage };

        accept(next);

        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That change couldn’t be saved.");

        return false;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [accept]
  );

  const reset = useCallback(async () => {
    try {
      const data = await stageRequest<JevStageBundle>("/api/prototypes/jev-stage", {
        method: "POST",
        body: JSON.stringify({ action: "reset" }),
      });

      accept(data);
      setError(null);

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t reset.");

      return false;
    }
  }, [accept]);

  const setEval = useCallback(
    async (turnId: string, signal: "up" | "down", note?: string | null) => {
      const data = await stageRequest<{ bundle: JevStageBundle }>(
        "/api/prototypes/jev-stage/eval",
        {
          method: "POST",
          body: JSON.stringify({ turnId, signal, note: note ?? null }),
        }
      );

      accept(data.bundle);
    },
    [accept]
  );

  const noop = useCallback(async () => undefined, []);

  return useMemo(
    () => ({
      state: bundle.stage ?? emptyStageState(),
      error,
      loading,
      sending,
      saving,
      send,
      mutate,
      refresh: load,
      retryDesign: noop,
      cancelSubagent: noop,
      reset,
      insights: bundle.insights,
      streamingText,
      setEval,
    }),
    [
      bundle.stage,
      bundle.insights,
      error,
      loading,
      sending,
      saving,
      send,
      mutate,
      load,
      noop,
      reset,
      streamingText,
      setEval,
    ]
  );
}

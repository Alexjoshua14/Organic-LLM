"use client";

import type { StageController } from "@/components/stage/stage";
import type { StageOperation, StageTurnSettings } from "@/lib/stage/schema";
import type {
  JevStageActionKind,
  JevStageBundle,
  JevStageStreamEvent,
  JevStageTraceEvent,
  JevStageTurnInsight,
} from "@/lib/jev-stage/schema";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { stageRequest, StageRequestError } from "@/components/stage/use-stage";
import { applyStageOperations, stageReservedRects } from "@/lib/stage/layout";
import { emptyStageState } from "@/lib/stage/schema";
import { JEV_STAGE_CLIENT_TIMEOUT_MS, JEV_STAGE_MAX_TURN_INSIGHTS } from "@/lib/jev-stage/constants";
import { emptyJevStageBundle } from "@/lib/jev-stage/schema";
import { shortModel } from "@/lib/jev-stage/trace-view";

const ACTION_LABEL: Record<JevStageActionKind, string> = {
  respond: "Respond",
  orchestrate: "Orchestrate",
  memory_search: "Memory search",
  web_search: "Web search",
  view_switch: "Switch view",
  captures: "File captures",
  recall: "Recall memories",
  designer_brief: "Brief designer",
  specialists: "Dispatch specialists",
};

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
  submittedMessage: { id: string; text: string } | null;
  turnStatus: string;
  liveTrace: JevStageTraceEvent[];
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
  const [submittedMessage, setSubmittedMessage] = useState<{ id: string; text: string } | null>(
    null
  );
  const [turnStatus, setTurnStatus] = useState("");
  const [liveTrace, setLiveTrace] = useState<JevStageTraceEvent[]>([]);
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

      setSubmittedMessage({ id: requestId, text: message });
      setTurnStatus("Received");
      setLiveTrace([]);
      const abort = new AbortController();
      const timeout = window.setTimeout(() => abort.abort(), JEV_STAGE_CLIENT_TIMEOUT_MS);

      try {
        const response = await fetch("/api/prototypes/jev-stage", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, requestId, settings }),
          signal: abort.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);

          throw new StageRequestError(data?.error ?? "Turn failed", response.status);
        }

        let sawDone = false;
        let streamFailed = false;
        let writing: string | null = null;

        await readNdjson(response, (event) => {
          if (!mounted.current) return;
          if (event.type === "delta") {
            setStreamingText((value) => value + event.text);
            if (writing) setTurnStatus(writing);
          } else if (event.type === "route") {
            const action = ACTION_LABEL[event.selected.kind];

            setTurnStatus(
              event.fellBack
                ? `Falling back to ${action}`
                : `Jev chose ${action} · ${event.selected.confidence.toFixed(2)}`
            );
          } else if (event.type === "trace") {
            const trace = event.event;

            setLiveTrace((events) => [...events, trace]);

            switch (trace.kind) {
              case "jev.start":
                setTurnStatus("Jev is choosing a route");
                break;
              case "hop.start":
                if (trace.model) {
                  const model = shortModel(trace.model);

                  writing = `Writing with ${model}`;
                  setTurnStatus(
                    trace.operation === "orchestrate"
                      ? `Orchestrating with ${model}`
                      : `Preparing a reply with ${model}`
                  );
                }
                break;
              case "hop.first_token":
                setTurnStatus(writing ?? "Writing a reply");
                break;
              case "hop.tool": {
                const name = trace.tool.name.replaceAll("_", " ");
                const result = trace.tool.ok === false ? "failed" : trace.tool.result;

                setTurnStatus(result ? `${name} · ${result}` : name);
                break;
              }
              case "hop.end":
                if (trace.note && trace.ok) setTurnStatus(trace.note);
                break;
              case "fallback":
                setTurnStatus(trace.to === "respond" ? "Falling back to Respond" : "Preparing a fallback reply");
                break;
            }
          } else if (event.type === "patch" || event.type === "done") {
            if (event.type === "done") sawDone = true;
            accept({
              stage: event.stage,
              insights:
                event.type === "done"
                  ? [
                      ...current.current.insights.filter((i) => i.turnId !== event.insight.turnId),
                      event.insight,
                    ].slice(-JEV_STAGE_MAX_TURN_INSIGHTS)
                  : current.current.insights,
            });
          } else if (event.type === "limit_error" || event.type === "error") {
            streamFailed = true;
            setError(event.message);
          }
        });
        // Keep the last streamed text visible until Stage messages include the reply.
        setStreamingText("");
        if (sawDone && !streamFailed) {
          setSubmittedMessage(null);
        } else {
          if (!streamFailed) setError("The reply stream ended early. Try again.");
          setTurnStatus("Message could not be completed");
        }

        return sawDone && !streamFailed;
      } catch (cause) {
        const message =
          cause instanceof Error && cause.name === "AbortError"
            ? "That turn took too long and was stopped. Try again."
            : cause instanceof Error
              ? cause.message
              : "Your message couldn’t be sent.";

        setError(message);
        setStreamingText("");
        setTurnStatus("Message could not be completed");

        return false;
      } finally {
        window.clearTimeout(timeout);
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
      setSubmittedMessage(null);

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
      submittedMessage,
      turnStatus,
      liveTrace,
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
      submittedMessage,
      turnStatus,
      liveTrace,
      setEval,
    ]
  );
}

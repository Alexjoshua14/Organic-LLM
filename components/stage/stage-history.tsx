"use client";

import type { StageEvent, StageState } from "@/lib/stage/schema";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { stageRequest } from "./use-stage";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";

export function StageHistory({
  mode,
  state,
  onClose,
  recessed = false,
}: {
  mode: "conversation" | "activity";
  state: StageState;
  onClose: () => void;
  recessed?: boolean;
}) {
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(before?: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await stageRequest<{ events: StageEvent[]; nextCursor: number | null }>(
        `/api/stage/events?limit=12${before ? `&before=${before}` : ""}`
      );

      setEvents((current) => (before ? [...current, ...data.events] : data.events));
      setCursor(data.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t load activity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode === "activity") void load();
  }, [mode]);

  return (
    <aside
      aria-label={mode === "conversation" ? "Conversation with Organic" : "Stage activity"}
      className={
        recessed
          ? "flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-muted/50 p-4 shadow-inner"
          : "stage-panel stage-history"
      }
      role="dialog"
    >
      <header
        className={
          recessed ? "flex items-center justify-between gap-2 text-sm" : "stage-panel-header"
        }
      >
        <h2>{mode === "conversation" ? "With Organic" : "Behind the stage"}</h2>
        <button
          aria-label="Close panel"
          className={
            recessed ? "organic-focus rounded p-1 text-muted-foreground" : "stage-icon-button"
          }
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>
      <div
        className={
          recessed
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain text-sm"
            : "stage-history-body"
        }
      >
        {mode === "conversation" ? (
          <>
            {state.messages.length === 0 && (
              <p className={recessed ? "text-muted-foreground" : "stage-muted"}>
                Start a conversation below. What you make can stay on the stage.
              </p>
            )}
            {state.messages.map((message) => (
              <div
                key={message.id}
                className={recessed ? "mb-4 space-y-1" : "stage-history-message"}
                data-role={message.role}
              >
                <span className={recessed ? "text-2xs text-muted-foreground" : undefined}>
                  {message.role === "user" ? "You" : (message.author?.name ?? "Organic")}
                </span>
                <div className={recessed ? "wrap-anywhere" : "stage-prose"}>
                  <ChatMessageMarkdown content={message.text} id={message.id} wrapCodeBlocks />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <p className="stage-muted">
              Encrypted snapshots keep your working context and model handoffs together.
            </p>
            <dl className="stage-models">
              <dt>Last called</dt>
              <dd>{state.lastModel ?? "No calls yet"}</dd>
              <dt>Next conversation</dt>
              <dd>{state.nextModel}</dd>
            </dl>
            {events.map((event) => (
              <details key={event.revision} className="stage-event">
                <summary>
                  <span>{event.cause.replaceAll("-", " ")}</span>
                  <time dateTime={event.at}>
                    {new Date(event.at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </summary>
                <dl className="stage-models">
                  <dt>Revision</dt>
                  <dd>{event.revision}</dd>
                  <dt>Model</dt>
                  <dd>{event.lastModel ?? "No model call"}</dd>
                  <dt>Next</dt>
                  <dd>{event.nextModel}</dd>
                  {event.usage && (
                    <>
                      <dt>Tokens in / out</dt>
                      <dd>
                        {event.usage.inputTokens.toLocaleString()} /{" "}
                        {event.usage.outputTokens.toLocaleString()}
                      </dd>
                    </>
                  )}
                </dl>
                <p className="stage-muted">{event.bundle.summary || "No working summary yet."}</p>
              </details>
            ))}
            {error && <p role="alert">{error}</p>}
            <button
              className="stage-text-button"
              disabled={loading}
              type="button"
              onClick={() => void load(cursor ?? undefined)}
            >
              {loading ? "Loading…" : cursor ? "Earlier snapshots" : "Refresh activity"}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

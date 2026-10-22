"use client";

import "./stage.css";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Grid3X3, History, MessageCircle, ArrowUpRight, RotateCcw } from "lucide-react";

import { useStage } from "./use-stage";
import { StageWidget } from "./stage-widget";
import { StageInspector } from "./stage-inspector";
import { StageHistory } from "./stage-history";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";

const STARTERS = [
  {
    label: "Map an idea",
    prompt: "Help me map an idea. Ask me what I’m exploring before making a diagram.",
  },
  {
    label: "Open a conversation",
    prompt: "Place a live chat on my stage, with plenty of room for a long conversation.",
  },
  { label: "Make something", prompt: "Let’s make something together. Ask me what I have in mind." },
];

export function Stage() {
  const { state, error, loading, sending, saving, send, mutate, refresh, retryDesign } = useStage();
  const [showGrid, setShowGrid] = useState(false);
  const [panel, setPanel] = useState<"conversation" | "activity" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const selected = state?.widgets.find((widget) => widget.id === selectedId);
  const working = state?.design?.status === "working";
  const failed = state?.design?.status === "failed";
  const latestReply = state?.messages.findLast((message) => message.role === "assistant");
  const empty = !state?.widgets.length;
  const status = loading
    ? "Opening your space"
    : sending
      ? "Thinking with you"
      : working
        ? "Making room for your ideas"
        : saving
          ? "Placing your piece"
          : failed
            ? "Designer needs a moment"
            : "Here, with you";

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanel(null);
        setSelectedId(null);
        composer.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        composer.current?.focus();
      }
    }

    window.addEventListener("keydown", keydown);

    return () => window.removeEventListener("keydown", keydown);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();

    if (!message || sending || !state) return;
    if (await send(message)) setDraft((current) => (current.trim() === message ? "" : current));
    composer.current?.focus();
  }

  function togglePanel(next: "conversation" | "activity") {
    setPanel((current) => (current === next ? null : next));
    setSelectedId(null);
  }

  return (
    <div className="organic-stage" data-grid={showGrid || !!selected} data-empty={empty}>
      <header className="stage-topbar">
        <div className="stage-wordmark">
          <span>organic</span>
          <span className="stage-wordmark-slash">/</span>
          <span>stage</span>
        </div>
        <nav aria-label="Stage controls" className="stage-tools">
          <button
            aria-label="Show grid"
            aria-pressed={showGrid}
            className="stage-tool"
            title="Show the 32 by 32 grid"
            type="button"
            onClick={() => setShowGrid((value) => !value)}
          >
            <Grid3X3 size={15} />
            <span>Grid</span>
          </button>
          <button
            aria-label="Conversation"
            aria-expanded={panel === "conversation"}
            className="stage-tool"
            type="button"
            onClick={() => togglePanel("conversation")}
          >
            <MessageCircle size={15} />
            <span>Conversation</span>
          </button>
          <button
            aria-label="Activity"
            aria-expanded={panel === "activity"}
            className="stage-tool"
            type="button"
            onClick={() => togglePanel("activity")}
          >
            <History size={15} />
            <span>Activity</span>
          </button>
        </nav>
      </header>

      <div className="stage-surface-wrap">
        <div aria-hidden className="stage-ruler stage-ruler-top">
          <span>01</span>
          <span>08</span>
          <span>16</span>
          <span>24</span>
          <span>32</span>
        </div>
        <div aria-hidden className="stage-ruler stage-ruler-side">
          <span>01</span>
          <span>16</span>
          <span>32</span>
        </div>
        <section aria-label="Your 32 by 32 stage" className="stage-surface">
          <div aria-hidden className="stage-registration">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="stage-agent">
            <button
              aria-label="Talk to Organic"
              className="stage-agent-button"
              type="button"
              onClick={() => composer.current?.focus()}
            >
              <OrganicActivityMark
                className="stage-agent-mark"
                seed="organic-stage"
                state={sending ? "working" : loading ? "waiting" : "idle"}
              />
            </button>
            <h1>Organic</h1>
            <p aria-live="polite" className="stage-agent-status">
              {status}
            </p>
            {working && (
              <span aria-hidden className="stage-designer-trace">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
          {state?.widgets.map((widget) => (
            <StageWidget
              key={widget.id}
              selected={widget.id === selectedId}
              widget={widget}
              onSelect={() => {
                setSelectedId((id) => (id === widget.id ? null : widget.id));
                setPanel(null);
              }}
            />
          ))}
          {empty && !loading && !latestReply && (
            <div className="stage-empty-caption">
              <span>A space for what’s on your mind.</span>
              <span>Start anywhere.</span>
            </div>
          )}
        </section>
        <div className="stage-surface-legend">
          <span>
            {empty
              ? "An open canvas"
              : `${state?.widgets.length} ${state?.widgets.length === 1 ? "piece" : "pieces"}, staying in place`}
          </span>
          <span>
            32 <span aria-hidden>×</span> 32
          </span>
        </div>
      </div>

      {selected && (
        <StageInspector
          key={selected.id}
          saving={saving}
          widget={selected}
          onChange={mutate}
          onClose={() => setSelectedId(null)}
        />
      )}
      {panel && state && (
        <StageHistory key={panel} mode={panel} state={state} onClose={() => setPanel(null)} />
      )}

      <footer className="stage-footer">
        <div className="stage-reply" aria-live="polite">
          {error ? (
            <div className="stage-error">
              <p role="alert">{error}</p>
              {!state && (
                <button className="stage-text-button" type="button" onClick={() => void refresh()}>
                  <RotateCcw size={13} />
                  Try again
                </button>
              )}
            </div>
          ) : failed ? (
            <div className="stage-error">
              <p>{state?.design?.error ?? "The designer couldn’t finish this arrangement."}</p>
              <button
                className="stage-text-button"
                type="button"
                onClick={() => void retryDesign()}
              >
                Try designer again
              </button>
            </div>
          ) : latestReply ? (
            <button
              aria-label="Read Organic’s response in conversation"
              className="stage-reply-text"
              type="button"
              onClick={() => togglePanel("conversation")}
            >
              <span>{latestReply.text}</span>
              <ArrowUpRight aria-hidden size={14} />
            </button>
          ) : (
            <div className="stage-starters">
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  className="stage-text-button"
                  disabled={!state || sending}
                  type="button"
                  onClick={() => {
                    setDraft(starter.prompt);
                    composer.current?.focus();
                  }}
                >
                  {starter.label}
                  <ArrowUpRight aria-hidden size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
        <form aria-label="Talk to Organic" className="stage-composer" onSubmit={submit}>
          <span aria-hidden className="stage-composer-dot" data-working={sending} />
          <textarea
            ref={composer}
            aria-label="Message Organic"
            disabled={!state}
            maxLength={8000}
            placeholder={loading ? "Opening your space…" : "What’s on your mind?"}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            aria-label={sending ? "Organic is responding" : "Send message"}
            className="stage-send"
            disabled={!state || sending || !draft.trim()}
            type="submit"
          >
            <ArrowUp size={19} />
          </button>
        </form>
        <div className="stage-footer-caption">
          <span>
            {working ? "The designer is working. Keep talking." : "A thought can become a place."}
          </span>
          <span className="stage-shortcut">⌘ / to focus</span>
        </div>
      </footer>
    </div>
  );
}

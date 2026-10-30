"use client";

import "./stage.css";

import type { ChatModel } from "@/lib/schemas/chat";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { StageTurnSettings } from "@/lib/stage/schema";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Grid3X3, History, MessageCircle, ArrowUpRight, RotateCcw } from "lucide-react";

import { useStage } from "./use-stage";
import { StageWidget } from "./stage-widget";
import { StageInspector } from "./stage-inspector";
import { StageHistory } from "./stage-history";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { CoreInput } from "@/components/chat/core-input";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { useVoiceScreenContext } from "@/hooks/use-voice-screen-context";
import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { coreInputScopes } from "@/lib/core-input/scopes";
import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";

const STAGE_COMPOSER_SCOPE = coreInputScopes.area("stage");

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
  const voice = useVoiceSessionOptional();
  const voiceActive = !!voice && (voice.connected || voice.connecting || voice.paused);
  const { state, error, loading, sending, saving, send, mutate, refresh, retryDesign } = useStage({
    voiceActive: !!voice && (voice.connected || voice.connecting),
  });
  const modelRef = useRef<ChatModel>(DEFAULT_COMPOSER_MODEL);
  const effortRef = useRef<ChatEffortLevel>("auto");
  const searchRef = useRef(false);
  const memoryRef = useRef(false);
  const speechRef = useRef(false);
  const [composerError, setComposerError] = useState<Error | null>(null);
  const [composerInject, setComposerInject] = useState<{ id: number; text: string } | null>(null);
  const settings = (): StageTurnSettings => ({
    model: modelRef.current.id,
    effort: effortRef.current,
    webSearch: searchRef.current,
    memory: memoryRef.current,
    speechFriendly: speechRef.current,
  });

  useVoiceScreenContext(state ? { kind: "stage", revision: String(state.revision) } : null);
  const [showGrid, setShowGrid] = useState(false);
  const [panel, setPanel] = useState<"conversation" | "activity" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const composer = useRef<HTMLDivElement>(null);
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
        composer.current?.querySelector("textarea")?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        composer.current?.querySelector("textarea")?.focus();
      }
    }

    window.addEventListener("keydown", keydown);

    return () => window.removeEventListener("keydown", keydown);
  }, []);

  function toggleVoice() {
    if (!voice) return;
    if (voice.connected || voice.connecting) voice.disconnect();
    else if (voice.paused && voice.stage) voice.resume();
    else voice.connect({ stage: true, stageSettings: settings() });
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
              onClick={() => composer.current?.querySelector("textarea")?.focus()}
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
          {error || voice?.error ? (
            <div className="stage-error">
              <p role="alert">{error || voice?.error}</p>
              {!state && (
                <button className="stage-text-button" type="button" onClick={() => void refresh()}>
                  <RotateCcw size={13} />
                  Try again
                </button>
              )}
            </div>
          ) : latestReply ? (
            <div className="stage-reply-text">
              {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named scroll region supports keyboard reading. */}
              <div
                aria-label="Organic’s latest response"
                className="stage-reply-copy stage-prose"
                role="region"
                tabIndex={0}
              >
                <ChatMessageMarkdown content={latestReply.text} id={latestReply.id} />
              </div>
              {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
              <button
                aria-label="Read Organic’s response in conversation"
                className="stage-icon-button"
                type="button"
                onClick={() => togglePanel("conversation")}
              >
                <ArrowUpRight aria-hidden size={14} />
              </button>
            </div>
          ) : (
            <div className="stage-starters">
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  className="stage-text-button"
                  disabled={!state || (sending && !voiceActive)}
                  type="button"
                  onClick={() => {
                    setComposerInject({ id: Date.now(), text: starter.prompt });
                    composer.current?.querySelector("textarea")?.focus();
                  }}
                >
                  {starter.label}
                  <ArrowUpRight aria-hidden size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
        {failed ? (
          <div className="stage-error stage-design-error">
            <p role="status">
              {state?.design?.error ?? "The designer couldn’t finish this arrangement."}
            </p>
            <button className="stage-text-button" type="button" onClick={() => void retryDesign()}>
              Try designer again
            </button>
          </div>
        ) : null}
        <div ref={composer} className="stage-core-input" data-voice-active={voiceActive}>
          <CoreInput
            variant="stage-beta"
            snapshotScope={STAGE_COMPOSER_SCOPE}
            modelRef={modelRef}
            effortRef={effortRef}
            useWebSearchRef={searchRef}
            useMemoriesRef={memoryRef}
            useSpeechFriendlyRef={speechRef}
            defaultWebSearch={false}
            defaultMemories={false}
            disabled={!state}
            status={sending ? "submitted" : "ready"}
            error={composerError}
            clearError={() => setComposerError(null)}
            stop={async () => undefined}
            showContextBudget={false}
            featureHints={false}
            composerInject={composerInject}
            placeholder={loading ? "Opening your space…" : "What’s on your mind?"}
            sendMessage={async (message) => {
              const text =
                "text" in (message ?? {}) ? String((message as { text: string }).text) : "";

              setComposerError(null);
              if (!(await send(text, settings()))) {
                const failure = new Error("Your message couldn’t be sent. Please try again.");

                setComposerError(failure);
                throw failure;
              }
            }}
            voiceControl={
              voice ? (
                <button
                  aria-label={
                    voice.connected || voice.connecting
                      ? "End voice session"
                      : voice.paused && voice.stage
                        ? "Resume voice session"
                        : "Start voice session"
                  }
                  aria-pressed={voiceActive}
                  className="stage-voice-button"
                  disabled={!state || (sending && !voiceActive)}
                  title={
                    voice.connected || voice.connecting ? "End voice session" : "Talk with Organic"
                  }
                  type="button"
                  onClick={toggleVoice}
                >
                  <AudioLines aria-hidden size={19} />
                </button>
              ) : null
            }
          />
        </div>
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

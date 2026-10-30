"use client";

import "./stage.css";

import type { ChatModel } from "@/lib/schemas/chat";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { StageTurnSettings, StageRect } from "@/lib/stage/schema";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AudioLines, Grid3X3, History, MessageCircle, ArrowUpRight, RotateCcw } from "lucide-react";

import { useStage } from "./use-stage";
import { StagePieces } from "./stage-pieces";
import { StageInspector } from "./stage-inspector";
import { StageAgent } from "./stage-agent";
import { StageResponse } from "./stage-response";
import { StageSubagents } from "./stage-subagents";
import { StageHistory } from "./stage-history";
import { useStageMeasurements } from "./use-stage-frame";

import { resolveStageView } from "@/lib/stage/views";
import {
  ORGANIC_STAGE_VIEW,
  STAGE_VIEW_EVENT,
  StageViewCommandSchema,
  type StageView,
} from "@/lib/stage/view-schema";
import { stageAgentReservations } from "@/lib/stage/layout";
import { emptyStageState } from "@/lib/stage/schema";
import { resolveStageFrame, stageCellStyle } from "@/lib/stage/frame";
import { ComposerActionButton } from "@/components/chat/composer-action-button";
import { CoreInput } from "@/components/chat/core-input";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { useVoiceScreenContext } from "@/hooks/use-voice-screen-context";
import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { coreInputScopes } from "@/lib/core-input/scopes";

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
  const {
    state,
    error,
    loading,
    sending,
    saving,
    send,
    mutate,
    refresh,
    retryDesign,
    cancelSubagent,
  } = useStage({
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
    presentation: { view, ...size, reading: frame.reading },
  });

  const [showGrid, setShowGrid] = useState(false);
  const [panel, setPanel] = useState<"conversation" | "activity" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { root, composer, size } = useStageMeasurements();
  const [view, setView] = useState<StageView>(ORGANIC_STAGE_VIEW);
  const author = view.kind === "author" ? view.id! : "organic";
  const pieceId = view.kind === "piece" ? view.id : null;
  const appliedCommands = useRef(new Set<string>());
  const [reading, setReading] = useState(false);

  const [preview, setPreview] = useState<{ id: string; rect: StageRect } | null>(null);
  const arrangePiece = useCallback((id: string) => {
    setPreview(null);
    setSelectedId((current) => (current === id ? null : id));
    setPanel(null);
  }, []);
  const previewPlacement = useCallback(
    (rect: StageRect | null) => {
      setPreview((current) => {
        if (!rect || !selectedId) return null;
        if (current?.id === selectedId && JSON.stringify(current.rect) === JSON.stringify(rect))
          return current;

        return { id: selectedId, rect };
      });
    },
    [selectedId]
  );
  const frame = useMemo(() => {
    const snapshot = state ?? emptyStageState();
    const snapshotWithPreview = preview
      ? {
          ...snapshot,
          widgets: snapshot.widgets.map((w) =>
            w.id === preview.id ? { ...w, rect: preview.rect } : w
          ),
        }
      : snapshot;

    return resolveStageFrame(snapshotWithPreview, {
      ...size,
      home: view.kind === "organic",
      author,
      reading,
      pieceId,
    });
  }, [state, size, view, author, reading, pieceId, preview]);

  const selectView = useCallback((next: StageView) => {
    setView(next);
    setReading(false);
    setSelectedId(null);
    setPreview(null);
    setPanel(null);
  }, []);

  function chooseAuthor(id: string) {
    selectView(id === "organic" ? ORGANIC_STAGE_VIEW : { kind: "author", id });
  }
  useEffect(() => {
    const command = state?.viewCommand;

    if (!command || appliedCommands.current.has(command.id)) return;
    appliedCommands.current.add(command.id);
    const next = resolveStageView(state!, command.target);

    if (next) selectView(next);
  }, [state, selectView]);
  useEffect(() => {
    const receiveView = (event: Event) => {
      const command = StageViewCommandSchema.safeParse((event as CustomEvent).detail);

      if (!command.success || !state || appliedCommands.current.has(command.data.id)) return;
      const next = resolveStageView(state, command.data.target);

      if (!next) {
        void refresh();

        return;
      }
      appliedCommands.current.add(command.data.id);
      selectView(next);
    };

    window.addEventListener(STAGE_VIEW_EVENT, receiveView);

    return () => window.removeEventListener(STAGE_VIEW_EVENT, receiveView);
  }, [state, selectView, refresh]);
  useVoiceScreenContext(
    state
      ? {
          kind: "stage",
          revision: String(state.revision),
          presentation: { view, ...size, reading: frame.reading },
        }
      : null
  );
  function closeArrangement() {
    setSelectedId(null);
    setPreview(null);
  }
  const selected = state?.widgets.find((widget) => widget.id === selectedId);
  const working = state?.design?.status === "working";
  const failed = state?.design?.status === "failed";
  const latestReply = state?.messages.findLast((message) => message.role === "assistant");
  const empty = !state?.widgets.length;
  const activeSubagents = state ? stageAgentReservations(state).length - 1 : 0;
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
            : activeSubagents
              ? `${activeSubagents === 1 ? "One specialist is" : "Two specialists are"} working with me`
              : "Here, with you";

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanel(null);
        setSelectedId(null);
        setPreview(null);
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
    setPreview(null);
  }

  return (
    <div
      ref={root}
      className="organic-stage"
      style={
        {
          gridTemplateRows: frame.gridTemplateRows,
          "--stage-grid-rows": frame.gridLines,
        } as CSSProperties
      }
      data-grid={showGrid || !!selected}
      data-empty={empty}
      data-compact={frame.compact}
      data-tiny={frame.tiny}
      data-short-children={frame.shortChildren}
    >
      <div aria-hidden className="stage-grid-guide" />
      <header className="stage-topbar" style={stageCellStyle(frame.header)}>
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

      <section aria-label="Your 32 by 32 stage" className="stage-surface">
        <StageAgent
          status={
            frame.tiny
              ? sending
                ? "Thinking"
                : activeSubagents
                  ? "Working together"
                  : "Here, with you"
              : status
          }
          rect={frame.parent}
          state={sending ? "working" : loading || activeSubagents > 0 ? "waiting" : "idle"}
          onFocus={() => {
            chooseAuthor("organic");
            composer.current?.querySelector("textarea")?.focus();
          }}
        />
        <StageSubagents
          agents={state?.subagents ?? []}
          design={state?.design}
          rects={frame.children}
          onSelect={chooseAuthor}
          onCancel={cancelSubagent}
        />
        <StagePieces
          widgets={state?.widgets ?? []}
          visible={frame.pieces}
          selectedId={selectedId}
          onArrange={arrangePiece}
        />
      </section>

      {selected && (
        <StageInspector
          key={selected.id}
          saving={saving}
          widget={selected}
          state={state!}
          onPreview={previewPlacement}
          onChange={mutate}
          onClose={closeArrangement}
        />
      )}
      {panel && state && (
        <StageHistory key={panel} mode={panel} state={state} onClose={() => setPanel(null)} />
      )}

      <footer className="stage-footer">
        <div className="stage-reply" style={stageCellStyle(frame.reply)}>
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
            <StageResponse
              state={state!}
              selectedAuthor={author}
              organicActive={view.kind === "organic"}
              pieces={state!.widgets}
              selectedPieceId={pieceId}
              onSelectPiece={(id) => selectView({ kind: "piece", id })}
              onShowPieces={
                state?.widgets.length ? () => selectView({ kind: "overview", id: null }) : undefined
              }
              onSelectAuthor={chooseAuthor}
              expanded={frame.reading}
              compact={frame.replyCompact}
              onToggleExpanded={() => setReading((v) => !v)}
              onOpenConversation={() => togglePanel("conversation")}
            />
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
          {failed ? (
            <div className="stage-error stage-design-error">
              <p role="status">
                {state?.design?.error ?? "The designer couldn’t finish this arrangement."}
              </p>
              <button
                className="stage-text-button"
                type="button"
                onClick={() => void retryDesign()}
              >
                Try designer again
              </button>
            </div>
          ) : null}
        </div>
        <div className="stage-composer-slot" style={stageCellStyle(frame.composer)}>
          <div ref={composer} className="stage-composer-measure">
            <div className="stage-core-input" data-voice-active={voiceActive}>
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
                    <ComposerActionButton
                      aria-label={
                        voice.connected || voice.connecting
                          ? "End voice session"
                          : voice.paused && voice.stage
                            ? "Resume voice session"
                            : "Start voice session"
                      }
                      aria-pressed={voiceActive}
                      className="size-9 min-w-9 p-0"
                      engaged={voiceActive}
                      disabled={!state || (sending && !voiceActive)}
                      title={
                        voice.connected || voice.connecting
                          ? "End voice session"
                          : "Talk with Organic"
                      }
                      type="button"
                      onClick={toggleVoice}
                    >
                      <AudioLines aria-hidden size={19} />
                    </ComposerActionButton>
                  ) : null
                }
              />
            </div>
            <div className="stage-footer-caption">
              <span>
                {working
                  ? "The designer is working. Keep talking."
                  : "A thought can become a place."}
              </span>
              <span className="stage-shortcut">⌘ / to focus</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

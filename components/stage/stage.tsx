"use client";

import "./stage.css";
import type { ContinuitySelection } from "@/lib/continuity/schema";
import type { ChatModel } from "@/lib/schemas/chat";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { StageTurnSettings, StageRect } from "@/lib/stage/schema";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AudioLines,
  Grid3X3,
  History,
  Layers,
  MessageCircle,
  Plus,
  ArrowUpRight,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { useStage } from "./use-stage";
import { StagePieces } from "./stage-pieces";
import { StageInspector } from "./stage-inspector";
import { StageAgent } from "./stage-agent";
import { StageResponse } from "./stage-response";
import { StageSubagents } from "./stage-subagents";
import { StageHistory } from "./stage-history";
import { useStageMeasurements } from "./use-stage-frame";

import { placeStageWidget } from "@/lib/stage/placements";
import { ContextPicker } from "@/components/continuity/context-picker";
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
import {
  DEFAULT_COMPOSER_MEMORIES,
  DEFAULT_COMPOSER_MODEL,
} from "@/lib/chat/composer-tool-defaults";
import { coreInputScopes } from "@/lib/core-input/scopes";

const STAGE_COMPOSER_SCOPE = coreInputScopes.area("stage");
// "New stage" asks once, inline: a second press within this window clears the stage.
const RESET_CONFIRM_MS = 4_000;
// In memory only, so demo drafts and settings never reach the real Stage composer.
const SCRIPTED_COMPOSER_SCOPE = { ...coreInputScopes.area("stage-demo"), ephemeral: true };

const STARTERS = [
  {
    label: "Empty my head",
    prompt:
      "I want to get some thoughts out of my head. Keep what matters and organize it as I go.",
  },
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

/** Everything the Stage view reads and does. The live Stage backs it with the API; the demo scripts it. */
export type StageController = ReturnType<typeof useStage>;

export function Stage() {
  const voice = useVoiceSessionOptional();

  return (
    <StageView
      stage={useStage({ voiceActive: !!voice && (voice.connected || voice.connecting) })}
    />
  );
}

export function StageView({
  stage,
  scripted = false,
  agentMessage,
  renderAgentStatus,
  conversationRail,
  defaultWebSearch = false,
  extraTools,
  stackPiecesOnMobile = false,
  composerPlaceholder = "What’s on your mind?",
}: {
  stage: StageController;
  /** A scripted stage has no real threads, calls, or voice session to attach to. */
  scripted?: boolean;
  agentMessage?: ReactNode;
  renderAgentStatus?: (status: string) => ReactNode;
  conversationRail?: HTMLElement | null;
  defaultWebSearch?: boolean;
  extraTools?: ReactNode;
  stackPiecesOnMobile?: boolean;
  composerPlaceholder?: string;
}) {
  const liveVoice = useVoiceSessionOptional();
  const voice = scripted ? null : liveVoice;
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
    reset,
  } = stage;
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    if (!confirmingReset) return;
    const timer = setTimeout(() => setConfirmingReset(false), RESET_CONFIRM_MS);

    return () => clearTimeout(timer);
  }, [confirmingReset]);
  const modelRef = useRef<ChatModel>(DEFAULT_COMPOSER_MODEL);
  const effortRef = useRef<ChatEffortLevel>("auto");
  const searchRef = useRef(defaultWebSearch);
  const memoryRef = useRef(DEFAULT_COMPOSER_MEMORIES);
  const speechRef = useRef(false);
  const [composerError, setComposerError] = useState<Error | null>(null);
  const [composerInject, setComposerInject] = useState<{ id: number; text: string } | null>(null);
  const [continuity, setContinuity] = useState<ContinuitySelection>();
  const settings = (): StageTurnSettings => ({
    continuity,
    model: modelRef.current.id,
    effort: effortRef.current,
    webSearch: searchRef.current,
    memory: memoryRef.current,
    speechFriendly: speechRef.current,
    presentation: { view, ...size, reading: frame.reading },
  });

  const [showGrid, setShowGrid] = useState(false);
  const [panel, setPanel] = useState<"conversation" | "activity" | null>(null);
  // Context, New stage, Pieces, Grid and Activity live behind one Tools toggle, so the bar
  // stays quiet; Conversation keeps its own button.
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setToolsOpen(false);
      setConfirmingReset(false);
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [toolsOpen]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { root, composer, wordmark, size } = useStageMeasurements();
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
            w.id === preview.id ? placeStageWidget(w, view, preview.rect) : w
          ),
        }
      : snapshot;

    return resolveStageFrame(snapshotWithPreview, {
      ...size,
      view,
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
    state && !scripted
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
    else voice.connect({ stage: true, stageSettings: { ...settings(), continuity: undefined } });
  }

  function togglePanel(next: "conversation" | "activity") {
    setPanel((current) => (current === next ? null : next));
    setSelectedId(null);
    setPreview(null);
  }

  const hasMobilePieces = stackPiecesOnMobile && frame.pieces.length > 0;
  const pieces = (
    <StagePieces
      widgets={state?.widgets ?? []}
      visible={frame.pieces}
      selectedId={selectedId}
      onArrange={arrangePiece}
      onChange={mutate}
    />
  );

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
      data-docked={!frame.centered}
      data-hero={frame.hero}
      data-compact={frame.compact}
      data-tiny={frame.tiny}
      data-short-children={frame.shortChildren}
    >
      <div aria-hidden className="stage-grid-guide" />
      <header className="stage-topbar" style={stageCellStyle(frame.header)}>
        <div ref={wordmark} className="stage-wordmark">
          <span>organic</span>
          <span className="stage-wordmark-slash">/</span>
          <span>stage</span>
        </div>
        <nav
          aria-label="Stage controls"
          className={extraTools ? "stage-tools max-md:relative" : "stage-tools"}
        >
          {/* Hidden, not unmounted: the context picker keeps its selection while closed. */}
          <div
            className={
              extraTools
                ? "stage-tool-tray max-md:absolute max-md:inset-e-0 max-md:top-full max-md:z-10 max-md:w-max max-md:rounded-lg max-md:border max-md:border-border max-md:bg-background"
                : "stage-tool-tray"
            }
            hidden={!toolsOpen}
            id="stage-tool-tray"
          >
            {!scripted && (
              <ContextPicker
                compact
                surface="stage"
                disabled={sending || Boolean(voice?.connected || voice?.connecting)}
                onChange={setContinuity}
              />
            )}
            {!!(state?.widgets.length || state?.messages.length) && (
              <button
                aria-label={confirmingReset ? "Confirm: clear the stage" : "New stage"}
                aria-pressed={confirmingReset}
                className="stage-tool"
                disabled={sending}
                title={
                  confirmingReset
                    ? "Press again to clear every piece and the conversation"
                    : "Start a new, empty stage"
                }
                type="button"
                onClick={async () => {
                  if (!confirmingReset) {
                    setConfirmingReset(true);

                    return;
                  }
                  setConfirmingReset(false);
                  if (await reset()) selectView(ORGANIC_STAGE_VIEW);
                }}
              >
                <Plus size={15} />
                <span>{confirmingReset ? "Clear everything?" : "New stage"}</span>
              </button>
            )}
            {!!state?.widgets.length && (
              <button
                aria-label="Pieces"
                aria-pressed={view.kind === "overview"}
                className="stage-tool"
                title={view.kind === "overview" ? "Back to Organic" : "Show every piece"}
                type="button"
                onClick={() =>
                  selectView(
                    view.kind === "overview" ? ORGANIC_STAGE_VIEW : { kind: "overview", id: null }
                  )
                }
              >
                <Layers size={15} />
                <span>Pieces</span>
              </button>
            )}
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
            {!scripted && (
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
            )}
          </div>
          <button
            aria-controls="stage-tool-tray"
            aria-expanded={toolsOpen}
            aria-label="Stage tools"
            className="stage-tool"
            data-active={!toolsOpen && (showGrid || !!continuity) ? "" : undefined}
            title={toolsOpen ? "Hide tools" : "Context, new stage, pieces, grid and activity"}
            type="button"
            onClick={() => {
              setToolsOpen((value) => !value);
              setConfirmingReset(false);
            }}
          >
            <SlidersHorizontal size={15} />
            <span>Tools</span>
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
          {extraTools}
        </nav>
      </header>

      <section aria-label="Your 32 by 32 stage" className="stage-surface">
        <div className={hasMobilePieces ? "contents max-md:hidden" : "contents"}>
          <StageAgent
            message={agentMessage}
            renderStatus={renderAgentStatus}
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
            hero={frame.hero}
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
        </div>
        {stackPiecesOnMobile ? (
          <div
            className={
              hasMobilePieces
                ? "contents max-md:flex max-md:min-h-0 max-md:min-w-0 max-md:flex-col max-md:gap-4 max-md:overflow-y-auto max-md:overscroll-contain max-md:[&>.stage-piece:not([hidden])]:shrink-0 max-md:[&>.stage-piece]:max-h-full"
                : "contents"
            }
            style={stageCellStyle({ ...frame.body, x: 0, w: frame.header.w })}
          >
            {hasMobilePieces && agentMessage && (
              <div className="flex shrink-0 justify-center text-center md:hidden">
                {agentMessage}
              </div>
            )}
            {pieces}
          </div>
        ) : (
          pieces
        )}
      </section>

      {selected && (
        <StageInspector
          key={`${view.kind}:${view.id}:${selected.id}`}
          view={view}
          saving={saving}
          widget={selected}
          state={state!}
          onPreview={previewPlacement}
          onChange={mutate}
          onClose={closeArrangement}
        />
      )}
      {panel &&
        state &&
        (panel === "conversation" && conversationRail ? (
          createPortal(
            <StageHistory recessed mode={panel} state={state} onClose={() => setPanel(null)} />,
            conversationRail
          )
        ) : (
          <StageHistory key={panel} mode={panel} state={state} onClose={() => setPanel(null)} />
        ))}

      <footer className="stage-footer">
        {/* Organic's words belong to the home view (and to reading). With pieces showing, the
            pieces are the reply; the full exchange stays one tap away in Conversation. */}
        {frame.showReply && (
          <div className="stage-reply" style={stageCellStyle(frame.reply)}>
            {latestReply ? (
              <StageResponse
                state={state!}
                selectedAuthor={author}
                expanded={frame.reading}
                onToggleExpanded={() => setReading((v) => !v)}
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
          </div>
        )}
        <div className="stage-composer-slot" style={stageCellStyle(frame.composer)}>
          {/* Notices sit inside the measured block, so the grid makes room only while one shows. */}
          <div ref={composer} className="stage-composer-measure">
            {error || voice?.error ? (
              <div className="stage-error">
                <p role="alert">{error || voice?.error}</p>
                {!state && (
                  <button
                    className="stage-text-button"
                    type="button"
                    onClick={() => void refresh()}
                  >
                    <RotateCcw size={13} />
                    Try again
                  </button>
                )}
              </div>
            ) : null}
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
            <div className="stage-core-input" data-voice-active={voiceActive}>
              <CoreInput
                variant="stage-beta"
                snapshotScope={scripted ? SCRIPTED_COMPOSER_SCOPE : STAGE_COMPOSER_SCOPE}
                modelRef={modelRef}
                effortRef={effortRef}
                useWebSearchRef={searchRef}
                useMemoriesRef={memoryRef}
                useSpeechFriendlyRef={speechRef}
                defaultWebSearch={defaultWebSearch}
                defaultMemories={DEFAULT_COMPOSER_MEMORIES}
                disabled={!state}
                status={sending ? "submitted" : "ready"}
                error={composerError}
                clearError={() => setComposerError(null)}
                stop={async () => undefined}
                showContextBudget={false}
                featureHints={false}
                composerInject={composerInject}
                placeholder={loading ? "Opening your space…" : composerPlaceholder}
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
                      <AudioLines aria-hidden className="size-4" />
                    </ComposerActionButton>
                  ) : null
                }
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

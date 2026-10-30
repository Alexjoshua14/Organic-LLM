"use client";

import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";
import type { ContextEffortLevel } from "@/lib/memory/context-effort";
import type { CoreInputInitialSettings } from "@/lib/core-input/settings-cookie";
import type { CoreInputScope } from "@/lib/core-input/scopes";
import type { CoreInputSettings, CoreInputSettingField } from "@/lib/core-input/settings";
import type { SteerAction } from "./footer/steer-action";

import {
  ChangeEventHandler,
  CSSProperties,
  SetStateAction,
  FormEvent,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { flushSync } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { useReducedMotion } from "framer-motion";

import "@/styles/CoreInputMorph.css";

import {
  PromptInput,
  PromptInputHeader,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputBody,
  PromptInputMessage,
  PromptInputTextarea,
} from "../../third-party/ai-elements/prompt-input";
import ShinyText from "../../ShinyText";
import { ChatMessageMarkdown } from "../chat-message-markdown";
import {
  CONTEXT_BUDGET_DRAFT_RESERVE_CLASS,
  ContextBudgetIndicator,
} from "../context-budget-indicator";
import { HomeComposerLumenShell } from "../home-composer-lumen-shell";

import {
  CoreInputControlsProvider,
  CoreInputControlsValue,
  InputMarkdownMode,
} from "./core-input-context";
import { CoreInputFooter } from "./footer/core-input-footer";
import { resolveFooterPlacement } from "./footer/footer-placement";
import { organicGlassSubmitClassName, PromptInputSubmit } from "./submit/submit-button";
import { OrganicSubmitGlyph, resolveOrganicSubmitState } from "./submit/submit-glyph";
import { useCoreInputLayout } from "./use-core-input-layout";

import { PersonaSpark } from "@/components/personas/persona-spark";
import { usePersonaSessionOptional } from "@/components/personas/persona-session-provider";
import { DiagramNodeChip } from "@/components/mermaid/diagram-node-chip";
import { CoreInputVoiceDrawerSlot } from "@/components/voice/core-input-voice-drawer-slot";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COMPOSER_EFFORT,
  DEFAULT_COMPOSER_MEMORIES,
  DEFAULT_COMPOSER_MODEL,
  DEFAULT_COMPOSER_WEB_SEARCH,
} from "@/lib/chat/composer-tool-defaults";
import { ChatModel, ChatModels, getSelectableChatModels } from "@/lib/schemas/chat";
import { getSettings, setSettings } from "@/lib/user-settings";
import {
  CHAT_EFFORT_LEVELS,
  ChatEffortLevel,
  clampEffortForModel,
} from "@/lib/schemas/chat-effort";
import { DEFAULT_CONTEXT_EFFORT } from "@/lib/memory/context-effort";
import { readLegacyComposerPrefs, writeLegacyComposerPrefs } from "@/lib/core-input/legacy-prefs";
import { createMorphTimeline, type MorphTimeline } from "@/lib/core-input/morph-timeline";
import {
  CORE_INPUT_MORPH_FAST_FORWARD_RATE,
  CORE_INPUT_MORPH_PULSE_MS,
} from "@/lib/core-input/morph-timing";
import { changedSettingFields, settingsEqual } from "@/lib/core-input/settings";
import { writeSettingsCookie } from "@/lib/core-input/settings-cookie";
import { useHydrated } from "@/hooks/use-hydrated";
import { coreInputSnapshots } from "@/lib/core-input/snapshot-store";
import { coreInputSnapshotSync } from "@/lib/core-input/snapshot-sync";
import { parseSlashCommand } from "@/lib/chat/slash-command";
import { useContextEffortSettings } from "@/hooks/use-context-effort-settings";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { deleteEmptyChat } from "@/data/supabase/chat";
import {
  isBlankChatMounted,
  releaseBlankChatMount,
  retainBlankChatMount,
} from "@/lib/chat/blank-chat-mount-registry";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { useComposerDraft } from "@/hooks/use-composer-draft";
import { useAutoModelPreview } from "@/hooks/use-auto-model-preview";
import { useDiagramNodeLinksOptional } from "@/lib/mermaid/diagram-node-links-context";
import { useMessageSendQueue } from "@/hooks/use-message-send-queue";
import { MessageSendQueueStrip } from "@/components/chat/message-send-queue-strip";
import { shouldEnqueueInsteadOfSend } from "@/lib/message-queue/dispatch-gates";
import { ThreadReferenceCard } from "@/components/chat/thread-reference/thread-reference-card";
import { parseThreadPointer, threadReferenceMarker } from "@/lib/chat/thread-reference";

type CoreInputProps = {
  /** Validated display seed for this scope, supplied by the request page. */
  initialSettings?: CoreInputInitialSettings | null;
  modelRef: React.RefObject<ChatModel>;
  effortRef?: React.RefObject<ChatEffortLevel>;
  useWebSearchRef: React.RefObject<boolean>;
  useMemoriesRef: React.RefObject<boolean>;
  useSpeechFriendlyRef?: React.RefObject<boolean>;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  error?: Error | unknown;
  clearError?: ReturnType<typeof useChat>["clearError"];
  /** Called when input restores text after error; use to clear parent-held error (e.g. chatError). */
  onErrorCleared?: () => void;
  stop: ReturnType<typeof useChat>["stop"];
  status: ReturnType<typeof useChat>["status"];
  disabled?: boolean;
  className?: string;
  /** When set with isBlankChat, blank chat is auto-deleted on unmount if input is empty. */
  chatId?: string;
  isBlankChat?: boolean;
  /** Arcadia: toggle between textarea and rendered markdown preview in the same body slot. */
  enableMarkdownInputPreview?: boolean;
  /** One-time composer seed from URL (not sent until the user submits). */
  initialDraft?: string;
  /** Strata page assistant: web/memory/speech toggles live on the Source tab. */
  hideWebMemorySpeechToggles?: boolean;
  /** Prototype-only v2 submit treatment; default keeps the current production button unchanged. */
  submitVariant?: "default" | "organic-glass";
  /** Optional: notified on every composer text change (for ritual / ambient UIs). */
  onComposerTextChange?: (text: string) => void;
  /** When true, textarea swaps to shimmer text while status is submitted/streaming. Default false. */
  sentMessageShimmer?: boolean;
  /** Override persisted model id key (e.g. Delphi vs main chat). Other prefs use global keys. */
  modelLocalStorageKey?: string;
  /** Initial model when no stored preference exists (defaults to Auto for routing). */
  defaultModel?: ChatModel;
  /** Override persisted effort key (e.g. Delphi vs main chat). */
  effortLocalStorageKey?: string;
  /** Initial effort when no stored preference exists. */
  defaultEffort?: ChatEffortLevel;
  /** Override persisted memory toggle key (e.g. introspection vs main chat). */
  memoryLocalStorageKey?: string;
  /** Initial memory toggle when no stored preference exists. */
  defaultMemories?: boolean;
  /** Initial web search toggle when no stored preference exists. */
  defaultWebSearch?: boolean;
  /** When `id` changes, replaces composer text (e.g. assist reply injection). */
  composerInject?: { id: number; text: string } | null;
  /** Cmd/Ctrl+Enter runs this instead of sending chat; primary submit unchanged. */
  onSecondarySubmit?: (text: string) => void | Promise<void>;
  secondarySubmitLabel?: string;
  secondarySubmitDisabled?: boolean;
  secondarySubmitPending?: boolean;
  /**
   * Compact single-line composer. Always uses the condensed footer, and drops the search and
   * memory toggles entirely (they are not in the overflow menu). See `footer/footer-placement.ts`.
   */
  variant?: "default" | "compact";
  /** First-run coachmarks for composer tools (dismiss persists in localStorage). */
  featureHints?: boolean;
  /** Gate steer-assist coachmark until Noesis assist is available (after first assistant turn). */
  steerHintShowWhen?: boolean;
  /** When false, hides the context budget donut. */
  showContextBudget?: boolean;
  /** Server stream snapshot from the latest assembled turn. */
  streamContextBudget?: ContextBudgetEstimate | null;
  /** Bumps server polling after each completed stream. */
  contextBudgetRefreshKey?: number;
  /** When set, context budget composes locally from scaffold + these messages. */
  threadMessages?: UIMessage[];
  experience?: ChatExperience;
  chatStyle?: ChatStyle;
  /**
   * Multi-mode: submit enqueues to the server queue instead of calling `sendMessage`.
   * Composer stays free while the agent streams or budget is exhausted.
   * Requires `chatId`. Arcadia multitask shell should pass this when multi mode is on.
   */
  queueSendMode?: boolean;
  /** Optional multitask subagent id stored with the queue row. */
  queueTargetAgentId?: string;
  /**
   * Surfaces that forward the unified persona (main chat, Arcadia) show its chip, and its Spark
   * replaces the send button while it is on.
   */
  personaEnabled?: boolean;
  /**
   * Remembers settings per thread or area, and morphs between them when the scope changes.
   * Omit to keep the legacy global prefs (sandbox labs and prototypes).
   */
  snapshotScope?: CoreInputScope;
  /** Mirrors the selected context effort for the caller's request builder. */
  contextEffortRef?: React.RefObject<ContextEffortLevel>;
  /**
   * `/name argument` commands run instead of sending. They pass the busy-stream gate, so a
   * command still works while the thread is answering.
   */
  slashCommands?: Partial<Record<string, (argument: string) => void>>;
  /**
   * Set while a side thread (e.g. `/btw`) owns the composer: drafts are not saved to
   * `chatId` and the context budget hides. Changing it clears the composer text.
   */
  sideThreadKey?: string | null;
  placeholder?: string;
};

/** Settings currently on screen in any CoreInput: the starting frame for the next morph. */
let lastDisplayedSettings: CoreInputSettings | null = null;

/** Morph pulses target controls through these `data-core-input-morph-*` names. */
const MORPH_PULSE_ATTRIBUTE: Record<CoreInputSettingField, string> = {
  modelId: "data-core-input-morph-model",
  effort: "data-core-input-morph-effort",
  contextEffort: "data-core-input-morph-context-effort",
  webSearch: "data-core-input-morph-search",
  memories: "data-core-input-morph-memory",
  speechFriendly: "data-core-input-morph-speech",
};

function resolveAction(action: SetStateAction<boolean>, previous: boolean): boolean {
  return typeof action === "function" ? action(previous) : action;
}

/** Max length for the in-flight shimmer copy (matches AiInputForm). */
const SENT_MESSAGE_DISPLAY_MAX = 2000;

function truncateSentMessageDisplay(raw: string): string {
  const t = raw.trim() === "" ? " " : raw.trim();

  return t.length > SENT_MESSAGE_DISPLAY_MAX ? `${t.slice(0, SENT_MESSAGE_DISPLAY_MAX)}\u2026` : t;
}

/**
 * The shared chat composer. Its parts, roughly top to bottom (draft hydration sits between
 * the settings declarations and their write paths):
 *
 * 1. **Settings state**: model, effort, context effort, and the search / memory / speech
 *    toggles. `commitUserChange` is the only path that persists; `applySettings` mirrors
 *    state into the caller's refs, which the request builder reads at send time.
 * 2. **Scope morph**: `morphTo` and the hydration effects that resolve per-scope snapshots
 *    (see `docs/design/core-input-morph.md`).
 * 3. **Draft**: blank-chat auto-delete, error restore, URL seed, assist inject, saved drafts.
 * 4. **Send**: busy-stream gate, slash commands, `handleSubmit`, and the steer action.
 * 5. **Render**: body (textarea, shimmer, or markdown preview), the controls context, then
 *    `CoreInputFooter` placed by `resolveFooterPlacement`.
 *
 * Footer controls never take props from here directly. They read `CoreInputControlsContext`
 * (`core-input-context.tsx`), so a control renders the same on the toolbar, in a menu, or in
 * the CoreInput lab.
 */
export const CoreInput: React.FC<CoreInputProps> = ({
  modelRef,
  effortRef,
  useWebSearchRef,
  useMemoriesRef,
  useSpeechFriendlyRef,
  sendMessage,
  error,
  clearError,
  onErrorCleared,
  stop,
  status,
  disabled,
  className,
  chatId,
  isBlankChat,
  enableMarkdownInputPreview = false,
  initialDraft,
  hideWebMemorySpeechToggles = false,
  submitVariant = "default",
  onComposerTextChange,
  sentMessageShimmer = false,
  modelLocalStorageKey,
  defaultModel = DEFAULT_COMPOSER_MODEL,
  effortLocalStorageKey,
  defaultEffort = DEFAULT_COMPOSER_EFFORT,
  memoryLocalStorageKey,
  defaultMemories = DEFAULT_COMPOSER_MEMORIES,
  defaultWebSearch = DEFAULT_COMPOSER_WEB_SEARCH,
  composerInject,
  onSecondarySubmit,
  secondarySubmitLabel = "Steer assist",
  secondarySubmitDisabled = false,
  secondarySubmitPending = false,
  variant = "default",
  featureHints = true,
  steerHintShowWhen = true,
  showContextBudget = true,
  streamContextBudget,
  contextBudgetRefreshKey = 0,
  threadMessages,
  experience,
  chatStyle,
  queueSendMode = false,
  queueTargetAgentId,
  personaEnabled = false,
  snapshotScope,
  initialSettings,
  contextEffortRef,
  slashCommands,
  sideThreadKey = null,
  placeholder,
}) => {
  const { refreshSidebarChats } = useSharedChatContext();
  const persona = usePersonaSessionOptional();
  const personaActive = personaEnabled && Boolean(persona?.session);
  const diagramNodeLinks = useDiagramNodeLinksOptional();
  const queueEnabled = shouldEnqueueInsteadOfSend(queueSendMode) && Boolean(chatId);
  const messageQueue = useMessageSendQueue({
    threadId: chatId,
    enabled: queueEnabled,
  });

  const modelStorageKey = modelLocalStorageKey ?? "organic-llm-selected-model";
  const effortStorageKey = effortLocalStorageKey ?? "organic-llm-selected-effort";
  const memoriesStorageKey = memoryLocalStorageKey ?? "organic-llm-memories";
  const legacyPrefKeys = useMemo(
    () => ({ model: modelStorageKey, effort: effortStorageKey, memories: memoriesStorageKey }),
    [modelStorageKey, effortStorageKey, memoriesStorageKey]
  );

  const [text, setText] = useState<string>("");
  const [recentlySentText, setRecentlySentText] = useState<string>(""); // For failed/aborted sends
  const recentlySentTextRef = useRef<string>(""); // So restore effect sees value before state flushes
  const pendingSendRef = useRef<{ threadId: string | undefined } | null>(null);
  const [pendingSend, setPendingSend] = useState<typeof pendingSendRef.current>(null);
  const hydrated = useHydrated();
  const seed =
    initialSettings?.scopeKey === snapshotScope?.key && !snapshotScope?.ephemeral
      ? initialSettings
      : null;
  // Client navigation starts from the last displayed frame; hydration must use the server seed.
  const [initialFrame] = useState<CoreInputSettings>(
    () =>
      (hydrated && snapshotScope ? lastDisplayedSettings : null) ??
      seed?.settings ?? {
        modelId: defaultModel.id,
        effort: defaultEffort,
        contextEffort: DEFAULT_CONTEXT_EFFORT,
        webSearch: defaultWebSearch,
        memories: defaultMemories,
        speechFriendly: false,
      }
  );
  const [model, setModel] = useState<ChatModel>(
    () => ChatModels.find((entry) => entry.id === initialFrame.modelId) ?? defaultModel
  );
  const [effort, setEffort] = useState<ChatEffortLevel>(initialFrame.effort);
  const isAdmin = useIsAdmin();
  const selectableModels = useMemo(() => getSelectableChatModels(isAdmin === true), [isAdmin]);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(initialFrame.webSearch);
  const [useMemories, setUseMemories] = useState<boolean>(initialFrame.memories);
  const [useSpeechFriendly, setUseSpeechFriendly] = useState<boolean>(initialFrame.speechFriendly);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [threadReferences, setThreadReferences] = useState<string[]>([]);
  const addThreadReference = (id: string) => {
    const pointer = parseThreadPointer(id);

    if (pointer) setThreadReferences((current) => [...new Set([...current, pointer])].slice(0, 8));
  };

  useEffect(() => {
    setThreadReferences([]);
  }, [chatId, sideThreadKey]);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const { showLabels, isCondensed } = useCoreInputLayout(toolsRef);
  const { enabled: experimentalContextEffort, level: savedContextEffort } =
    useContextEffortSettings(
      seed
        ? { enabled: seed.experimentalContextEffort, level: seed.settings.contextEffort }
        : undefined
    );
  const [contextEffort, setContextEffort] = useState<ContextEffortLevel>(
    initialFrame.contextEffort
  );
  const showContextEffort = experience === "arcadia" && useMemories && experimentalContextEffort;
  const [inputMarkdownMode, setInputMarkdownMode] = useState<InputMarkdownMode>("edit");
  const reduceMotion = useReducedMotion();
  const morphRootRef = useRef<HTMLDivElement | null>(null);
  const morphRef = useRef<MorphTimeline | null>(null);
  const [morphing, setMorphing] = useState(false);
  const settingsRef = useRef<CoreInputSettings>(initialFrame);
  const snapshotScopeRef = useRef(snapshotScope);

  snapshotScopeRef.current = snapshotScope;
  const scopeKey = snapshotScope?.key ?? null;
  const hasHydratedRef = useRef(false);
  const seededOnMount = useRef(Boolean(seed));
  const appliedInitialDraft = useRef(false);
  const appliedComposerInjectId = useRef<number | null>(null);

  // Refs for unmount cleanup: must see latest values when component unmounts
  const inputEmptyRef = useRef(false);
  const statusRef = useRef<typeof status>("ready");
  const isBlankChatRef = useRef(Boolean(isBlankChat));

  inputEmptyRef.current = text.trim() === "" && threadReferences.length === 0;
  statusRef.current = status ?? "ready";
  isBlankChatRef.current = Boolean(isBlankChat);
  // Mirror the toggle state into the caller-owned refs every render, so the value
  // sent (read from the ref at submit time) always matches what the composer shows.
  if (useWebSearchRef) useWebSearchRef.current = useWebSearch;
  if (useMemoriesRef) useMemoriesRef.current = useMemories;

  /**
   * Auto-delete blank chats only on true leave (unmount with no remount).
   *
   * Important: do **not** list `isBlankChat` in the effect deps. On the first send,
   * AI SDK `pushMessage` updates messages (isBlankChat → false) before `status`
   * becomes `"submitted"`. An effect cleanup that closed over `isBlankChat: true`
   * would call `deleteEmptyChat` while the optimistic message was not yet persisted,
   * deleting the thread mid-turn (Arcadia multitask looks like a crash + new chat).
   */
  useEffect(() => {
    if (!chatId) return;

    retainBlankChatMount(chatId);

    return () => {
      releaseBlankChatMount(chatId);

      const shouldDelete =
        isBlankChatRef.current && inputEmptyRef.current && statusRef.current === "ready";

      if (!shouldDelete) return;

      const id = chatId;

      queueMicrotask(() => {
        // Same-tick remount (multitask layout / Strict Mode) — keep the thread.
        if (isBlankChatMounted(id)) return;

        void deleteEmptyChat(id).then((res) => {
          if (res.ok) refreshSidebarChats();
        });
      });
    };
  }, [chatId, refreshSidebarChats]);

  useEffect(() => {
    if (!enableMarkdownInputPreview) {
      setInputMarkdownMode("edit");
    }
  }, [enableMarkdownInputPreview]);

  // Restore input text when the last send failed (e.g. rate limit). Use ref so we have the
  // sent text even when the error arrives before React has committed setRecentlySentText.
  useEffect(() => {
    const hasError = status === "error" || error;
    const toRestore = recentlySentText || recentlySentTextRef.current;

    if (hasError && toRestore && text.trim() === "") {
      setText(toRestore);
      setRecentlySentText("");
      recentlySentTextRef.current = "";
      // Sync into the actual textarea (PromptInput internal state) so the user sees it
      if (textareaRef.current) {
        textareaRef.current.value = toRestore;
        textareaRef.current.dispatchEvent(new Event("input", { bubbles: true }));
        textareaRef.current.focus();
      }
      clearError?.();
      onErrorCleared?.();
    }
  }, [status, error, recentlySentText, text.trim(), clearError, onErrorCleared]);

  // Clear preserved sent text when the round-trip completes (mirrors AiInputForm).
  useEffect(() => {
    if (status !== "ready") return;
    setRecentlySentText("");
    recentlySentTextRef.current = "";
  }, [status]);

  // Seed composer from homepage routing (or similar) once; does not auto-send.
  useLayoutEffect(() => {
    if (appliedInitialDraft.current) return;
    const draft = initialDraft?.trim();

    if (!draft) return;
    appliedInitialDraft.current = true;
    setText(draft);
    const el = textareaRef.current;

    if (el) {
      el.value = draft;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    }
  }, [initialDraft]);

  useEffect(() => {
    if (!composerInject) return;
    if (appliedComposerInjectId.current === composerInject.id) return;
    appliedComposerInjectId.current = composerInject.id;
    setText(composerInject.text);
    onComposerTextChange?.(composerInject.text);
    const el = textareaRef.current;

    if (el) {
      el.value = composerInject.text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      if (composerInject.text.length > 0) {
        el.focus();
      }
    }
  }, [composerInject, onComposerTextChange]);

  const hasHigherPriorityHydration = useCallback(() => {
    if (composerInject && appliedComposerInjectId.current !== composerInject.id) {
      return true;
    }

    if (appliedComposerInjectId.current === composerInject?.id) {
      return true;
    }

    const draft = initialDraft?.trim();

    if (draft && !appliedInitialDraft.current) {
      return true;
    }

    if (appliedInitialDraft.current && draft) {
      return true;
    }

    return false;
  }, [composerInject, initialDraft]);

  const { clearDraftOnSend, draftRestored } = useComposerDraft({
    // A side thread's text belongs to that thread, not to `chatId`'s saved draft.
    chatId: sideThreadKey ? undefined : chatId,
    text,
    setText,
    textareaRef,
    onComposerTextChange,
    status: status ?? "ready",
    error,
    hasHigherPriorityHydration,
  });

  const appliedModelIdRef = useRef<string | null>(null);
  const userChangedInScopeRef = useRef(false);

  // State and the caller's refs move together. Refs update synchronously so a send right
  // after (e.g. finishing a morph on submit) reads the settled values, not the last render's.
  const applySettings = useCallback(
    (next: CoreInputSettings) => {
      const nextModel = ChatModels.find((m) => m.id === next.modelId) ?? defaultModel;
      const settled = { ...next, modelId: nextModel.id };

      settingsRef.current = settled;
      lastDisplayedSettings = settled;
      setModel((current) => (current.id === nextModel.id ? current : nextModel));
      setEffort(settled.effort);
      setContextEffort(settled.contextEffort);
      setUseWebSearch(settled.webSearch);
      setUseMemories(settled.memories);
      setUseSpeechFriendly(settled.speechFriendly);
      // Only on a real model change: callers such as the Strata assistant override this ref.
      if (modelRef && appliedModelIdRef.current !== nextModel.id) modelRef.current = nextModel;
      appliedModelIdRef.current = nextModel.id;
      if (effortRef) effortRef.current = settled.effort;
      if (contextEffortRef) contextEffortRef.current = settled.contextEffort;
      if (useWebSearchRef) useWebSearchRef.current = settled.webSearch;
      if (useMemoriesRef) useMemoriesRef.current = settled.memories;
      if (useSpeechFriendlyRef) useSpeechFriendlyRef.current = settled.speechFriendly;
    },
    [
      contextEffortRef,
      defaultModel,
      effortRef,
      modelRef,
      useMemoriesRef,
      useSpeechFriendlyRef,
      useWebSearchRef,
    ]
  );

  const persistUserSettings = useCallback(
    (next: CoreInputSettings, previous: CoreInputSettings) => {
      const scope = snapshotScopeRef.current;

      // A side thread's changes end with it: no cache, no sync, no legacy prefs.
      if (scope?.ephemeral) {
        coreInputSnapshots.writeEphemeral(scope.key, next);

        return;
      }

      if (scope) {
        coreInputSnapshots.commit(scope, next);
        coreInputSnapshotSync.schedulePush();
      }

      writeLegacyComposerPrefs(localStorage, legacyPrefKeys, next);
      if (next.contextEffort !== previous.contextEffort) {
        setSettings({ contextEffortLevel: next.contextEffort });
      }
    },
    [legacyPrefKeys]
  );

  /** The only path that persists: settings the user chose, never settings they were shown. */
  const commitUserChange = useCallback(
    (partial: Partial<CoreInputSettings>) => {
      // Land the user's change on the morph's final frame rather than under a pending step.
      morphRef.current?.finish();
      const previous = settingsRef.current;
      const next = { ...previous, ...partial };

      next.effort = clampEffortForModel(next.modelId, next.effort);
      if (settingsEqual(previous, next)) return;
      userChangedInScopeRef.current = true;
      applySettings(next);
      persistUserSettings(next, previous);
    },
    [applySettings, persistUserSettings]
  );

  const commitToggle = useCallback(
    (field: "webSearch" | "memories" | "speechFriendly", action: SetStateAction<boolean>) => {
      morphRef.current?.finish();
      commitUserChange({ [field]: resolveAction(action, settingsRef.current[field]) });
    },
    [commitUserChange]
  );
  const setUseWebSearchFromUser = useCallback(
    (action: SetStateAction<boolean>) => commitToggle("webSearch", action),
    [commitToggle]
  );
  const setUseMemoriesFromUser = useCallback(
    (action: SetStateAction<boolean>) => commitToggle("memories", action),
    [commitToggle]
  );
  const setUseSpeechFriendlyFromUser = useCallback(
    (action: SetStateAction<boolean>) => commitToggle("speechFriendly", action),
    [commitToggle]
  );
  const handleContextEffortChange = useCallback(
    (level: ContextEffortLevel) => commitUserChange({ contextEffort: level }),
    [commitUserChange]
  );

  /**
   * Moves CoreInput from `from` to `target`, one changed field at a time across the morph.
   * No `from` (first paint of an unscoped composer), no changes, or reduced motion: instant.
   */
  const morphTo = useCallback(
    (target: CoreInputSettings, from: CoreInputSettings | null) => {
      morphRef.current?.cancel();
      morphRef.current = null;
      const root = morphRootRef.current;
      const fields = from ? changedSettingFields(from, target) : [];

      if (!from || fields.length === 0 || reduceMotion || !root) {
        setMorphing(false);
        applySettings(target);

        return;
      }

      if (!settingsEqual(settingsRef.current, from)) applySettings(from);
      setMorphing(true);
      morphRef.current = createMorphTimeline({
        steps: fields,
        onStep: (field) => {
          applySettings({ ...settingsRef.current, [field]: target[field] });
          const attribute = MORPH_PULSE_ATTRIBUTE[field];

          root.setAttribute(attribute, "");
          window.setTimeout(() => root.removeAttribute(attribute), CORE_INPUT_MORPH_PULSE_MS);
        },
        onProgress: (progress) => {
          root.style.setProperty("--core-input-morph-progress", String(progress));
        },
        onDone: () => {
          morphRef.current = null;
          setMorphing(false);
        },
      });
    },
    [applySettings, reduceMotion]
  );

  useEffect(() => () => morphRef.current?.cancel(), []);

  // Seeds paint immediately. Without a cookie, wait until all passive preference reads
  // settle. Client-only remounts keep the controls visible while the scope morph runs.
  const [settingsReady, setSettingsReady] = useState(Boolean(seed) || hydrated);

  useEffect(() => setSettingsReady(true), []);

  // Resolve settings on mount and on every scope change, morphing from what was on screen.
  useLayoutEffect(() => {
    const scope = snapshotScopeRef.current;
    const legacy = readLegacyComposerPrefs(localStorage, legacyPrefKeys, {
      modelId: defaultModel.id,
      effort: defaultEffort,
      contextEffort: getSettings().contextEffortLevel ?? DEFAULT_CONTEXT_EFFORT,
      webSearch: defaultWebSearch,
      memories: defaultMemories,
      speechFriendly: false,
    });
    const target = scope ? coreInputSnapshots.resolve(scope, legacy) : legacy;
    // A remount (navigating between areas) has no frame of its own; start from the last shown.
    const from = hasHydratedRef.current
      ? settingsRef.current
      : seededOnMount.current
        ? initialFrame
        : scope
          ? lastDisplayedSettings
          : null;

    writeSettingsCookie({
      experimentalContextEffort: getSettings().experimentalContextEffort,
      experimentalArcadiaMarkdownPreview: getSettings().experimentalArcadiaMarkdownPreview,
    });
    hasHydratedRef.current = true;
    userChangedInScopeRef.current = false;
    if (scope) coreInputSnapshotSync.start();
    // Unscoped composers own the legacy prefs outright and re-save them on load, as before
    // snapshots. Scoped ones only write them on a user change, never by being viewed.
    else writeLegacyComposerPrefs(localStorage, legacyPrefKeys, target);
    morphTo(target, from);
  }, [
    scopeKey,
    initialFrame,
    legacyPrefKeys,
    defaultEffort,
    defaultMemories,
    defaultModel,
    defaultWebSearch,
    morphTo,
  ]);

  // A server pull can land after mount with this scope's settings from another device.
  // Follow it unless the user has already changed something here.
  useEffect(() => {
    if (!scopeKey) return;

    return coreInputSnapshots.subscribe(() => {
      const scope = snapshotScopeRef.current;

      if (!scope || userChangedInScopeRef.current) return;
      const target = coreInputSnapshots.resolve(scope, settingsRef.current);

      if (!settingsEqual(target, settingsRef.current)) morphTo(target, settingsRef.current);
    });
  }, [scopeKey, morphTo]);

  // Unscoped composers follow the global context-effort setting (e.g. changed in Settings).
  useEffect(() => {
    if (scopeKey || !hasHydratedRef.current) return;
    if (savedContextEffort === settingsRef.current.contextEffort) return;
    applySettings({ ...settingsRef.current, contextEffort: savedContextEffort });
  }, [savedContextEffort, scopeKey, applySettings]);

  // Snap effort when the selected model doesn't support the current level. A correction,
  // not a choice, so it is applied without persisting.
  useEffect(() => {
    const next = clampEffortForModel(model.id, effort);

    if (next !== effort) {
      applySettings({ ...settingsRef.current, effort: next });
    }
  }, [model.id, effort, applySettings]);

  // Entering or leaving a side thread hands the composer over with an empty field.
  const sideThreadKeyRef = useRef(sideThreadKey);

  useEffect(() => {
    if (sideThreadKeyRef.current === sideThreadKey) return;
    sideThreadKeyRef.current = sideThreadKey;
    setText("");
    onComposerTextChange?.("");
    const el = textareaRef.current;

    if (el) {
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    }
  }, [sideThreadKey, onComposerTextChange]);

  const fastForwardMorph = useCallback(() => {
    morphRef.current?.speedUp(CORE_INPUT_MORPH_FAST_FORWARD_RATE);
  }, []);

  const isSubmitBlocked = () =>
    disabled ||
    (!queueEnabled &&
      (statusRef.current === "submitted" ||
        statusRef.current === "streaming" ||
        (pendingSendRef.current !== null && pendingSendRef.current.threadId === chatId)));

  const matchSlashCommand = (raw: string) => {
    const command = parseSlashCommand(raw);
    const run = command ? slashCommands?.[command.name] : undefined;

    return command && run ? { run, argument: command.argument } : null;
  };

  const handleSubmitCapture = (event: FormEvent<HTMLFormElement>) => {
    // Commands never send to the thread, so a busy thread must not swallow them.
    if (matchSlashCommand(textareaRef.current?.value ?? text)) return;
    if (!isSubmitBlocked()) return;
    // Block before PromptInput clears text or converts and removes attachments.
    event.preventDefault();
    event.stopPropagation();
  };

  const handleSubmit = (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Use form payload first; fallback to current input state (covers FormData quirks e.g. when no PromptInputProvider)
    const textFromForm = (message.text ?? "").trim();
    const textFromState = text.trim();
    const textToSend = textFromForm || textFromState || (textareaRef.current?.value ?? "").trim();
    const slashCommand = matchSlashCommand(textToSend);

    if (slashCommand) {
      flushSync(() => {
        setText("");
        onComposerTextChange?.("");
      });
      clearDraftOnSend();
      slashCommand.run(slashCommand.argument);

      return;
    }

    // File conversion can finish after status changes, or before React publishes the first send.
    if (isSubmitBlocked()) return;
    const hasText = Boolean(textToSend);
    const hasAttachments = Boolean(message.files?.length) || threadReferences.length > 0;

    if (!(hasText || hasAttachments)) {
      return;
    }

    const finalText =
      [textToSend, ...threadReferences.map(threadReferenceMarker)].filter(Boolean).join("\n\n") ||
      "Sent with attachments";

    // Sending mid-morph sends the settings being morphed to; finishing writes the refs now.
    morphRef.current?.finish();
    const settled = settingsRef.current;
    const submission = queueEnabled ? null : { threadId: chatId };

    if (submission) {
      pendingSendRef.current = submission;
      setPendingSend(submission);
    }

    // Disarm blank-chat auto-delete before clearing the composer. AI SDK appends the
    // user message before status flips to "submitted"; an unmount in that window must
    // not treat this thread as an abandoned blank chat.
    isBlankChatRef.current = false;

    // Store the text of the recently sent message for failed/aborted sends (ref = no race with effect)
    recentlySentTextRef.current = finalText;
    setRecentlySentText(finalText);

    flushSync(() => {
      setText("");
      setThreadReferences([]);
      onComposerTextChange?.("");
      if (enableMarkdownInputPreview) {
        setInputMarkdownMode("edit");
      }
    });

    if (queueEnabled) {
      // Multi-mode: enqueue only — server dispatches when idle + budget allows.
      // Attachments are not queued yet (open question); text path stays free.
      void messageQueue.enqueue(
        finalText,
        {
          model: ChatModels.find((m) => m.id === settled.modelId) ?? model,
          effort: settled.effort,
          webSearch: settled.webSearch,
          memory: settled.memories,
          speechFriendly: settled.speechFriendly,
          experience,
          messageSearch: true,
        },
        queueTargetAgentId
      );
    } else {
      void sendMessage({
        text: finalText,
        files: message.files,
      })
        .finally(() => {
          if (pendingSendRef.current !== submission) return;
          pendingSendRef.current = null;
          setPendingSend(null);
        })
        .catch(() => {
          // The chat owner reports SDK errors; always release the synchronous send guard.
        });
    }

    diagramNodeLinks?.clearLinks();
    clearDraftOnSend();
  };

  // Restored prefs may hold an admin-only model; downgrade once admin status resolves.
  useEffect(() => {
    if (isAdmin === false && model.adminOnly) {
      applySettings({ ...settingsRef.current, modelId: defaultModel.id });
    }
  }, [isAdmin, model, defaultModel, applySettings]);

  const handleModelSelection = useCallback(
    (id: string) => {
      // Find the model object among the models this user may select
      const selectedModel = selectableModels.find((modelObj) => modelObj.id === id);

      if (selectedModel) commitUserChange({ modelId: selectedModel.id });
    },
    [selectableModels, commitUserChange]
  );

  const handleEffortSelection = useCallback(
    (id: string) => {
      const selectedEffort = CHAT_EFFORT_LEVELS.find((row) => row.id === id);

      if (!selectedEffort) return;
      commitUserChange({ effort: selectedEffort.id });
    },
    [commitUserChange]
  );

  const autoModelPreview = useAutoModelPreview({
    selectedModelId: model.id,
    text,
    experience,
    webSearch: useWebSearch,
    memory: useMemories,
  });

  const handleInputChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      const v = e.target.value;

      setText(v);
      autoModelPreview.notifyKeystroke();
      onComposerTextChange?.(v);
    },
    [autoModelPreview, onComposerTextChange]
  );

  // Steer: one guard shared by Cmd/Ctrl+Enter, the inline button, and the overflow menu item.
  const runSecondarySubmit = useCallback(() => {
    const raw = (textareaRef.current?.value ?? text).trim();

    if (!onSecondarySubmit || !raw || secondarySubmitDisabled || secondarySubmitPending) return;
    void onSecondarySubmit(raw);
  }, [onSecondarySubmit, secondarySubmitDisabled, secondarySubmitPending, text]);

  const steer = useMemo<SteerAction | null>(
    () =>
      onSecondarySubmit
        ? {
            label: secondarySubmitLabel,
            pending: secondarySubmitPending,
            available: !secondarySubmitDisabled && !secondarySubmitPending && Boolean(text.trim()),
            run: runSecondarySubmit,
          }
        : null,
    [
      onSecondarySubmit,
      runSecondarySubmit,
      secondarySubmitDisabled,
      secondarySubmitLabel,
      secondarySubmitPending,
      text,
    ]
  );

  const handleTextareaKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      e.preventDefault();
      runSecondarySubmit();
    },
    [runSecondarySubmit]
  );
  const composerStatus = queueEnabled
    ? "ready"
    : pendingSend !== null && pendingSend.threadId === chatId && status === "ready"
      ? "submitted"
      : status;
  const organicSubmitState = resolveOrganicSubmitState(
    composerStatus,
    text.trim().length > 0 || threadReferences.length > 0
  );

  const showSentShimmer =
    !queueEnabled &&
    sentMessageShimmer === true &&
    (status === "submitted" || status === "streaming");
  const sentDisplaySource = recentlySentText || recentlySentTextRef.current;
  const sentDisplayText = truncateSentMessageDisplay(sentDisplaySource);
  const composerBodyMeasureClass =
    "w-full min-h-11 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-base text-foreground md:text-sm";

  const renderComposerBody = () => {
    if (showSentShimmer) {
      return (
        <div aria-live="polite" className="w-full min-w-0 max-w-full px-3 py-3" role="status">
          <span className="sr-only">Sending message</span>
          <ShinyText as="div" className={composerBodyMeasureClass} text={sentDisplayText} />
        </div>
      );
    }

    if (enableMarkdownInputPreview && inputMarkdownMode === "preview") {
      return (
        <>
          <input name="message" type="hidden" value={text} />
          <div
            aria-label="Markdown preview"
            className={cn(
              "w-full min-w-0 max-w-full min-h-11 max-h-40 overflow-y-auto overflow-x-auto px-3 py-3 text-base md:text-sm",
              "prose prose-sm dark:prose-invert max-w-full text-foreground",
              "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
              "[&_img]:max-w-full [&_img]:h-auto"
            )}
            role="region"
          >
            {text.trim() ? (
              <ChatMessageMarkdown
                content={text}
                id="arcadia-composer-markdown-preview"
                wrapCodeBlocks
              />
            ) : (
              <p className="text-muted-foreground not-prose m-0">Nothing to preview</p>
            )}
          </div>
        </>
      );
    }

    const editBody = (
      <PromptInputTextarea
        ref={textareaRef}
        value={text}
        className={cn(
          variant === "compact" && "min-h-8 max-h-24 resize-none",
          // The corner badge widens to show the draft's token count; wrap text before it.
          showContextBudget && text.trim() && CONTEXT_BUDGET_DRAFT_RESERVE_CLASS
        )}
        {...(placeholder ? { placeholder } : {})}
        onChange={handleInputChange}
        onPasteCapture={(event) => {
          const id = parseThreadPointer(event.clipboardData.getData("text/plain"));

          if (!id || threadReferences.length >= 8) return;
          event.preventDefault();
          event.stopPropagation();
          addThreadReference(id);
        }}
        onKeyDown={onSecondarySubmit ? handleTextareaKeyDown : undefined}
        onSelect={autoModelPreview.notifySelectionOrCursorMove}
      />
    );

    return editBody;
  };

  const useCondensedLayout = variant === "compact" || isCondensed;
  // Which footer controls render, and where. The rules live in footer/footer-placement.ts.
  const footerPlacement = resolveFooterPlacement({
    condensed: useCondensedLayout,
    compact: variant === "compact",
    personaEnabled,
    hideWebMemorySpeechToggles,
    hasSpeechFriendly: Boolean(useSpeechFriendlyRef),
    hasMarkdownPreview: enableMarkdownInputPreview,
    previewingMarkdown: inputMarkdownMode === "preview",
    hasSteer: Boolean(onSecondarySubmit),
    showContextEffort,
  });

  const controlsValue = useMemo<CoreInputControlsValue>(
    () => ({
      showLabels,
      useCondensedLayout,
      useWebSearch,
      setUseWebSearch: setUseWebSearchFromUser,
      useMemories,
      setUseMemories: setUseMemoriesFromUser,
      useSpeechFriendly,
      setUseSpeechFriendly: setUseSpeechFriendlyFromUser,
      inputMarkdownMode,
      setInputMarkdownMode,
      model,
      selectableModels,
      onModelChange: handleModelSelection,
      effort,
      onEffortChange: handleEffortSelection,
      showContextEffort,
      contextEffort,
      onContextEffortChange: handleContextEffortChange,
      autoModelPreview,
    }),
    [
      showLabels,
      useCondensedLayout,
      useWebSearch,
      setUseWebSearchFromUser,
      useMemories,
      setUseMemoriesFromUser,
      useSpeechFriendly,
      setUseSpeechFriendlyFromUser,
      inputMarkdownMode,
      model,
      selectableModels,
      handleModelSelection,
      effort,
      handleEffortSelection,
      showContextEffort,
      contextEffort,
      handleContextEffortChange,
      autoModelPreview,
    ]
  );

  const contextBudgetControl =
    showContextBudget && !sideThreadKey ? (
      <ContextBudgetIndicator
        chatId={chatId}
        chatStyle={chatStyle}
        draftText={text}
        experience={experience}
        memoryEnabled={useMemories}
        messageSearchEnabled
        modelId={model.id}
        refreshKey={contextBudgetRefreshKey}
        speechFriendly={useSpeechFriendly}
        streamBudget={streamContextBudget}
        threadMessages={threadMessages}
        webSearchEnabled={useWebSearch}
      />
    ) : null;

  const submitControl = (
    <PromptInputSubmit
      // Spread only when set: an explicit `aria-label={undefined}` would override the button's
      // own "Submit"/"Abort" label, which PromptInputSubmit applies before `...props`.
      {...(personaActive && status === "ready" ? { "aria-label": "Send to Artist assistant" } : {})}
      className={cn(
        submitVariant === "organic-glass" && !personaActive && organicGlassSubmitClassName,
        personaActive && "overflow-hidden rounded-lg bg-transparent p-0 hover:bg-transparent"
      )}
      variant={personaActive ? "ghost" : undefined}
      // Multi-mode: always submit (never stop). Default: keep stop available while streaming.
      disabled={
        queueEnabled
          ? (!text.trim() && threadReferences.length === 0) || disabled
          : (!text && !status && threadReferences.length === 0) || disabled
      }
      status={composerStatus}
      stop={queueEnabled ? undefined : stop}
    >
      {personaActive ? (
        // The persona's visual is where its reply comes from: idle, deciding, then speaking.
        <PersonaSpark
          pulseKey={persona?.lastReceipt?.at ?? null}
          size={32}
          state={
            queueEnabled || status === "ready" || status === "error"
              ? "idle"
              : status === "submitted"
                ? "deciding"
                : "speaking"
          }
        />
      ) : submitVariant === "organic-glass" ? (
        <OrganicSubmitGlyph state={organicSubmitState} />
      ) : undefined}
    </PromptInputSubmit>
  );

  const composer = (
    <PromptInput
      aria-busy={showSentShimmer ? true : undefined}
      data-dim-background
      globalDrop
      multiple
      className={cn("z-40 w-full min-w-0", className)}
      onSubmit={handleSubmit}
      onSubmitCapture={handleSubmitCapture}
    >
      {contextBudgetControl ? (
        <div className="absolute right-1.5 top-1 z-20">{contextBudgetControl}</div>
      ) : null}

      {/* Carries no padding of its own: the attachment rail brings `p-3`, and an
          empty header would otherwise reserve a blank band above the textarea. */}
      <PromptInputHeader className="p-0">
        {threadReferences.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {threadReferences.map((id) => (
              <ThreadReferenceCard
                key={id}
                id={id}
                onRemove={() =>
                  setThreadReferences((current) => current.filter((item) => item !== id))
                }
              />
            ))}
          </div>
        ) : null}
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
        {diagramNodeLinks && diagramNodeLinks.links.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {diagramNodeLinks.links.map((link) => (
              <DiagramNodeChip
                key={link.id}
                link={link}
                onRemove={() => diagramNodeLinks.removeLink(link.id)}
              />
            ))}
          </div>
        ) : null}
      </PromptInputHeader>

      <PromptInputBody>
        {draftRestored ? (
          <span className="sr-only" aria-live="polite">
            Draft restored
          </span>
        ) : null}
        {renderComposerBody()}
      </PromptInputBody>
      <CoreInputFooter
        locked={Boolean(disabled) || showSentShimmer}
        placement={footerPlacement}
        settingsReady={settingsReady}
        // Coachmark anchors move into the menu or shrink on a condensed footer, so hints wait.
        showFeatureHints={featureHints && !useCondensedLayout}
        steer={steer}
        steerHintShowWhen={steerHintShowWhen}
        submit={submitControl}
        textareaRef={textareaRef}
        toolsRef={toolsRef}
        onDictation={setText}
        onThreadReference={addThreadReference}
      />
    </PromptInput>
  );

  const shell = !useMemories ? (
    composer
  ) : (
    <HomeComposerLumenShell className="core-input-memory-lumen">{composer}</HomeComposerLumenShell>
  );

  return (
    <CoreInputControlsProvider value={controlsValue}>
      {/* Positioning context for the live voice drawer; layout-neutral otherwise. Touching
          the composer mid-morph fast-forwards the morph (see morph-timing). */}
      <div
        ref={morphRootRef}
        className="relative w-full min-w-0"
        data-core-input-morph={morphing ? "running" : undefined}
        style={{ "--core-input-morph-pulse-ms": `${CORE_INPUT_MORPH_PULSE_MS}ms` } as CSSProperties}
        onKeyDownCapture={fastForwardMorph}
        onPointerDownCapture={fastForwardMorph}
      >
        <CoreInputVoiceDrawerSlot />
        {queueEnabled ? (
          <MessageSendQueueStrip
            budget={messageQueue.budget}
            className="mb-2"
            items={messageQueue.items}
          />
        ) : null}
        <div className="relative">
          {shell}
          {morphing ? <span aria-hidden className="core-input-morph-sheen" /> : null}
        </div>
      </div>
    </CoreInputControlsProvider>
  );
};

"use client";

import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";

import {
  ChangeEventHandler,
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
import { Loader2 } from "lucide-react";

import {
  PromptInput,
  PromptInputHeader,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputBody,
  PromptInputMessage,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputButton,
  PromptInputFooter,
} from "../../third-party/ai-elements/prompt-input";
import ShinyText from "../../ShinyText";
import { ChatMessageMarkdown } from "../chat-message-markdown";
import { ComposerAddFilesButton } from "../composer-add-files-button";
import { ComposerMicButton } from "../composer-mic-button";
import { ComposerSettingsMenu } from "../composer-settings-menu";
import { ContextBudgetIndicator } from "../context-budget-indicator";
import { HomeComposerLumenShell } from "../home-composer-lumen-shell";

import {
  CoreInputControlsProvider,
  CoreInputControlsValue,
  InputMarkdownMode,
} from "./core-input-context";
import { ComposerModelEffortSelect } from "./controls/model-effort-select";
import { ComposerPreviewChip } from "./controls/preview-chip";
import { ComposerSpeechChip } from "./controls/speech-chip";
import { ComposerToolToggleGroup } from "./controls/tool-toggle-group";
import { PromptInputSubmit } from "./submit/submit-button";
import { OrganicSubmitGlyph } from "./submit/submit-glyph";

import { DiagramNodeChip } from "@/components/mermaid/diagram-node-chip";
import { FeatureHint } from "@/components/onboarding/feature-hint";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COMPOSER_EFFORT,
  DEFAULT_COMPOSER_MEMORIES,
  DEFAULT_COMPOSER_MODEL,
  DEFAULT_COMPOSER_WEB_SEARCH,
} from "@/lib/chat/composer-tool-defaults";
import { ChatModel, ChatModels, getSelectableChatModels } from "@/lib/schemas/chat";
import {
  CHAT_EFFORT_LEVELS,
  ChatEffortLevel,
  clampEffortForModel,
} from "@/lib/schemas/chat-effort";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { deleteEmptyChat } from "@/data/supabase/chat";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { useComposerDraft } from "@/hooks/use-composer-draft";
import { useDiagramNodeLinksOptional } from "@/lib/mermaid/diagram-node-links-context";

type CoreInputProps = {
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
  /** Compact single-line composer; toggles live in the overflow menu. */
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
};

/** Max length for the in-flight shimmer copy (matches AiInputForm). */
const SENT_MESSAGE_DISPLAY_MAX = 2000;

function truncateSentMessageDisplay(raw: string): string {
  const t = raw.trim() === "" ? " " : raw.trim();

  return t.length > SENT_MESSAGE_DISPLAY_MAX ? `${t.slice(0, SENT_MESSAGE_DISPLAY_MAX)}\u2026` : t;
}

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
}) => {
  const { refreshSidebarChats } = useSharedChatContext();
  const diagramNodeLinks = useDiagramNodeLinksOptional();

  const modelStorageKey = modelLocalStorageKey ?? "organic-llm-selected-model";
  const effortStorageKey = effortLocalStorageKey ?? "organic-llm-selected-effort";
  const memoriesStorageKey = memoryLocalStorageKey ?? "organic-llm-memories";
  const STORAGE_KEY_WEB_SEARCH = "organic-llm-web-search";
  const STORAGE_KEY_SPEECH_FRIENDLY = "organic-llm-speech-friendly";
  const STORAGE_KEY_TIMESTAMP = "organic-llm-prefs-timestamp";
  const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  const [text, setText] = useState<string>("");
  const [recentlySentText, setRecentlySentText] = useState<string>(""); // For failed/aborted sends
  const recentlySentTextRef = useRef<string>(""); // So restore effect sees value before state flushes
  const [model, setModel] = useState<ChatModel>(defaultModel);
  const [effort, setEffort] = useState<ChatEffortLevel>(defaultEffort);
  const isAdmin = useIsAdmin();
  const selectableModels = useMemo(() => getSelectableChatModels(isAdmin === true), [isAdmin]);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(defaultWebSearch);
  const [useMemories, setUseMemories] = useState<boolean>(defaultMemories);
  const [useSpeechFriendly, setUseSpeechFriendly] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const showLabelsRef = useRef(false);
  const isCondensedRef = useRef(false);
  const [showLabels, setShowLabels] = useState(false);
  const [isCondensed, setIsCondensed] = useState(false);
  const [inputMarkdownMode, setInputMarkdownMode] = useState<InputMarkdownMode>("edit");
  const hasLoadedPrefs = useRef(false);
  const appliedInitialDraft = useRef(false);
  const appliedComposerInjectId = useRef<number | null>(null);

  // Refs for unmount cleanup: must see latest values when component unmounts
  const inputEmptyRef = useRef(false);
  const statusRef = useRef<typeof status>("ready");

  inputEmptyRef.current = text.trim() === "";
  statusRef.current = status ?? "ready";
  // Mirror the toggle state into the caller-owned refs every render, so the value
  // sent (read from the ref at submit time) always matches what the composer shows.
  if (useWebSearchRef) useWebSearchRef.current = useWebSearch;
  if (useMemoriesRef) useMemoriesRef.current = useMemories;

  // Auto-delete blank chat when user navigates away with empty input
  useEffect(() => {
    return () => {
      if (chatId && isBlankChat && inputEmptyRef.current && statusRef.current === "ready") {
        deleteEmptyChat(chatId).then((res) => {
          if (res.ok) refreshSidebarChats();
        });
      }
    };
  }, [chatId, isBlankChat, refreshSidebarChats]);

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
    chatId,
    text,
    setText,
    textareaRef,
    onComposerTextChange,
    status: status ?? "ready",
    error,
    hasHigherPriorityHydration,
  });

  // Load preferences from localStorage on mount
  useLayoutEffect(() => {
    if (hasLoadedPrefs.current) return;
    hasLoadedPrefs.current = true;

    const timestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
    const isExpired = !timestamp || Date.now() - parseInt(timestamp, 10) > EXPIRY_MS;

    if (isExpired) {
      // Clear expired preferences
      localStorage.removeItem(modelStorageKey);
      localStorage.removeItem(effortStorageKey);
      localStorage.removeItem(memoriesStorageKey);
      localStorage.removeItem(STORAGE_KEY_WEB_SEARCH);
      localStorage.removeItem(STORAGE_KEY_SPEECH_FRIENDLY);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);

      setUseWebSearch(defaultWebSearch);
      setUseMemories(defaultMemories);
      setEffort(defaultEffort);
      if (modelRef) modelRef.current = defaultModel;
      if (effortRef) effortRef.current = defaultEffort;

      return;
    }

    // Load stored preferences
    const storedModel = localStorage.getItem(modelStorageKey);
    let nextModel = defaultModel;

    if (storedModel) {
      const found = ChatModels.find((m) => m.id === storedModel);

      if (found) {
        nextModel = found;
        setModel(found);
      }
    }

    const storedEffort = localStorage.getItem(effortStorageKey);
    let nextEffort = defaultEffort;

    if (storedEffort && CHAT_EFFORT_LEVELS.some((row) => row.id === storedEffort)) {
      nextEffort = storedEffort as ChatEffortLevel;
      setEffort(nextEffort);
    }

    const storedWebSearch = localStorage.getItem(STORAGE_KEY_WEB_SEARCH);
    let nextWebSearch = defaultWebSearch;

    if (storedWebSearch === "true") nextWebSearch = true;
    else if (storedWebSearch === "false") nextWebSearch = false;
    setUseWebSearch(nextWebSearch);

    const storedMemories = localStorage.getItem(memoriesStorageKey);
    let nextMemories = defaultMemories;

    if (storedMemories === "true") nextMemories = true;
    else if (storedMemories === "false") nextMemories = false;
    setUseMemories(nextMemories);

    const storedSpeechFriendly = localStorage.getItem(STORAGE_KEY_SPEECH_FRIENDLY);

    if (storedSpeechFriendly === "true") setUseSpeechFriendly(true);

    if (modelRef) modelRef.current = nextModel;
    if (effortRef) effortRef.current = nextEffort;
  }, [
    defaultEffort,
    defaultMemories,
    defaultModel,
    defaultWebSearch,
    effortRef,
    effortStorageKey,
    memoriesStorageKey,
    modelRef,
    modelStorageKey,
    useMemoriesRef,
    useWebSearchRef,
  ]);

  // Update timestamp whenever preferences are saved
  const updatePrefsTimestamp = () => {
    localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(Date.now()));
  };

  // Sync model to ref and persist to localStorage
  useEffect(() => {
    if (modelRef && modelRef.current !== model) {
      modelRef.current = model;
    }
    if (hasLoadedPrefs.current) {
      localStorage.setItem(modelStorageKey, model.id);
      updatePrefsTimestamp();
    }
  }, [model, modelRef, modelStorageKey]);

  useEffect(() => {
    if (effortRef && effortRef.current !== effort) {
      effortRef.current = effort;
    }
    if (hasLoadedPrefs.current) {
      localStorage.setItem(effortStorageKey, effort);
      updatePrefsTimestamp();
    }
  }, [effort, effortRef, effortStorageKey]);

  // Snap effort when the selected model doesn't support the current level.
  useEffect(() => {
    const next = clampEffortForModel(model.id, effort);

    if (next !== effort) {
      setEffort(next);
    }
  }, [model.id, effort]);

  // Persist web search to localStorage (ref is mirrored at render time).
  useEffect(() => {
    if (hasLoadedPrefs.current) {
      localStorage.setItem(STORAGE_KEY_WEB_SEARCH, String(useWebSearch));
      updatePrefsTimestamp();
    }
  }, [useWebSearch]);

  // Persist memories to localStorage (ref is mirrored at render time).
  useEffect(() => {
    if (hasLoadedPrefs.current) {
      localStorage.setItem(memoriesStorageKey, String(useMemories));
      updatePrefsTimestamp();
    }
  }, [useMemories, memoriesStorageKey]);

  // Sync speech-friendly to ref and persist to localStorage
  useEffect(() => {
    if (useSpeechFriendlyRef && useSpeechFriendlyRef.current !== useSpeechFriendly) {
      useSpeechFriendlyRef.current = useSpeechFriendly;
    }
    if (hasLoadedPrefs.current) {
      localStorage.setItem(STORAGE_KEY_SPEECH_FRIENDLY, String(useSpeechFriendly));
      updatePrefsTimestamp();
    }
  }, [useSpeechFriendly, useSpeechFriendlyRef]);

  useLayoutEffect(() => {
    const el = toolsRef.current;

    if (!el) return;

    /** Wider threshold to show labels; lower to hide — avoids oscillation at the breakpoint. */
    const SHOW_LABELS_AT_PX = 640;
    const HIDE_LABELS_AT_PX = 600;
    /** Narrow composer: icon chips + overflow for secondary tools; model/effort stay visible. */
    const CONDENSED_AT_PX = 600;
    const EXPANDED_AT_PX = 640;

    const applyWidth = (width: number) => {
      // Ignore pre-layout 0 widths so we don't lock into condensed on desktop.
      if (width < 1) return;

      const nextLabels = showLabelsRef.current
        ? width >= HIDE_LABELS_AT_PX
        : width >= SHOW_LABELS_AT_PX;

      if (nextLabels !== showLabelsRef.current) {
        showLabelsRef.current = nextLabels;
        setShowLabels(nextLabels);
      }

      const nextCondensed = isCondensedRef.current
        ? width < EXPANDED_AT_PX
        : width < CONDENSED_AT_PX;

      if (nextCondensed !== isCondensedRef.current) {
        isCondensedRef.current = nextCondensed;
        setIsCondensed(nextCondensed);
      }
    };

    const measureTarget = (el.closest("[data-prompt-input-shell]") as HTMLElement | null) ?? el;

    applyWidth(measureTarget.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      applyWidth(entries[0]?.contentRect.width ?? 0);
    });

    observer.observe(measureTarget);

    return () => observer.disconnect();
  }, []);

  const handleSubmit = (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Use form payload first; fallback to current input state (covers FormData quirks e.g. when no PromptInputProvider)
    const textFromForm = (message.text ?? "").trim();
    const textFromState = text.trim();
    const textToSend = textFromForm || textFromState || (textareaRef.current?.value ?? "").trim();
    const hasText = Boolean(textToSend);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    const finalText = textToSend || "Sent with attachments";

    // Store the text of the recently sent message for failed/aborted sends (ref = no race with effect)
    recentlySentTextRef.current = finalText;
    setRecentlySentText(finalText);

    flushSync(() => {
      setText("");
      onComposerTextChange?.("");
      if (enableMarkdownInputPreview) {
        setInputMarkdownMode("edit");
      }
    });

    sendMessage({
      text: finalText,
      files: message.files,
    });

    diagramNodeLinks?.clearLinks();
    clearDraftOnSend();
  };

  // Restored prefs may hold an admin-only model; downgrade once admin status resolves.
  useEffect(() => {
    if (isAdmin === false && model.adminOnly) {
      setModel(defaultModel);
    }
  }, [isAdmin, model, defaultModel]);

  const handleModelSelection = useCallback(
    (id: string) => {
      // Find the model object among the models this user may select
      const selectedModel = selectableModels.find((modelObj) => modelObj.id === id);

      if (selectedModel) setModel(selectedModel);
    },
    [selectableModels]
  );

  const handleEffortSelection = useCallback(
    (id: string) => {
      const selectedEffort = CHAT_EFFORT_LEVELS.find((row) => row.id === id);

      if (!selectedEffort) return;
      setEffort(clampEffortForModel(model.id, selectedEffort.id));
    },
    [model.id]
  );

  const handleInputChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      const v = e.target.value;

      setText(v);
      onComposerTextChange?.(v);
    },
    [onComposerTextChange]
  );

  const handleTextareaKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      if (!onSecondarySubmit) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      e.preventDefault();
      const raw = (textareaRef.current?.value ?? text).trim();

      if (!raw || secondarySubmitDisabled || secondarySubmitPending) return;
      void onSecondarySubmit(raw);
    },
    [onSecondarySubmit, secondarySubmitDisabled, secondarySubmitPending, text]
  );
  const organicSubmitState =
    status === "submitted"
      ? "sent"
      : status === "streaming"
        ? "awaiting"
        : status === "error"
          ? "error"
          : text.trim().length > 0
            ? "ready"
            : "idle";

  const showSentShimmer =
    sentMessageShimmer === true && (status === "submitted" || status === "streaming");
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
        className={cn(variant === "compact" && "min-h-10 max-h-24 resize-none")}
        onChange={handleInputChange}
        onKeyDown={onSecondarySubmit ? handleTextareaKeyDown : undefined}
      />
    );

    return editBody;
  };

  const showComposerToolHints =
    featureHints && !hideWebMemorySpeechToggles && variant !== "compact" && !isCondensed;
  const showComposerModelHint = featureHints && variant !== "compact" && !isCondensed;
  const showSteerHint = featureHints && Boolean(onSecondarySubmit) && !isCondensed;
  const useCondensedLayout = variant === "compact" || isCondensed;

  const controlsValue = useMemo<CoreInputControlsValue>(
    () => ({
      showLabels,
      useCondensedLayout,
      useWebSearch,
      setUseWebSearch,
      useMemories,
      setUseMemories,
      useSpeechFriendly,
      setUseSpeechFriendly,
      inputMarkdownMode,
      setInputMarkdownMode,
      model,
      selectableModels,
      onModelChange: handleModelSelection,
      effort,
      onEffortChange: handleEffortSelection,
    }),
    [
      showLabels,
      useCondensedLayout,
      useWebSearch,
      useMemories,
      useSpeechFriendly,
      inputMarkdownMode,
      model,
      selectableModels,
      handleModelSelection,
      effort,
      handleEffortSelection,
    ]
  );

  const toolToggles =
    !hideWebMemorySpeechToggles && variant !== "compact" ? (
      showComposerToolHints ? (
        <FeatureHint id="composer-search-memory">
          <ComposerToolToggleGroup />
        </FeatureHint>
      ) : (
        <ComposerToolToggleGroup />
      )
    ) : null;

  const composerSettingsMenu = useCondensedLayout ? (
    <ComposerSettingsMenu
      enableMarkdownInputPreview={enableMarkdownInputPreview}
      hasDraft={Boolean(text.trim())}
      inputMarkdownMode={inputMarkdownMode}
      secondarySubmitDisabled={secondarySubmitDisabled}
      secondarySubmitLabel={secondarySubmitLabel}
      secondarySubmitPending={secondarySubmitPending}
      useSpeechFriendly={useSpeechFriendly}
      onMarkdownModeToggle={() =>
        setInputMarkdownMode((mode) => (mode === "edit" ? "preview" : "edit"))
      }
      onSecondarySubmit={
        onSecondarySubmit
          ? () => {
              const raw = (textareaRef.current?.value ?? text).trim();

              if (!raw || secondarySubmitDisabled || secondarySubmitPending) return;
              void onSecondarySubmit(raw);
            }
          : undefined
      }
      onSpeechFriendlyChange={
        useSpeechFriendlyRef ? (value) => setUseSpeechFriendly(value) : undefined
      }
    />
  ) : null;

  const attachmentActions = (
    <>
      <ComposerAddFilesButton />
      {(!enableMarkdownInputPreview || inputMarkdownMode === "edit") && (
        <ComposerMicButton textareaRef={textareaRef} onTranscriptionChange={setText} />
      )}
    </>
  );

  const contextBudgetControl = showContextBudget ? (
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

  const steerButton =
    onSecondarySubmit && !useCondensedLayout
      ? (() => {
          const button = (
            <PromptInputButton
              disabled={
                secondarySubmitDisabled ||
                secondarySubmitPending ||
                !text.trim() ||
                disabled ||
                showSentShimmer
              }
              size="dynamic-sm"
              title="Run steer on the current text (⌘ or Ctrl + Enter)"
              type="button"
              variant="ghost"
              onClick={() => {
                const raw = (textareaRef.current?.value ?? text).trim();

                if (!raw || secondarySubmitDisabled || secondarySubmitPending) return;
                void onSecondarySubmit(raw);
              }}
            >
              {secondarySubmitPending ? (
                <Loader2 aria-hidden className="size-4 animate-spin shrink-0" />
              ) : null}
              <span className={cn("max-w-28 truncate text-xs", !showLabels && "sr-only")}>
                {secondarySubmitLabel}
              </span>
            </PromptInputButton>
          );

          return showSteerHint ? (
            <FeatureHint id="noesis-steer-assist" showWhen={steerHintShowWhen}>
              {button}
            </FeatureHint>
          ) : (
            button
          );
        })()
      : null;

  const submitControl = (
    <PromptInputSubmit
      className={cn(
        submitVariant === "organic-glass" &&
          "organic-glass-preview border border-white/20 bg-linear-to-br from-background/86 via-background/60 to-background-tertiary/42 text-foreground shadow-[0_10px_36px_-18px_rgba(20,21,22,0.65),inset_0_1px_0_rgba(255,255,255,0.38)] backdrop-blur-xl hover:border-accent/25 hover:text-foreground dark:border-white/10 dark:from-background-secondary/82 dark:via-background/62 dark:to-background-tertiary/38"
      )}
      disabled={(!text && !status) || disabled}
      status={status}
      stop={stop}
    >
      {submitVariant === "organic-glass" ? (
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
    >
      {contextBudgetControl ? (
        <div className="absolute right-1.5 top-1 z-20">{contextBudgetControl}</div>
      ) : null}

      {/* Carries no padding of its own: the attachment rail brings `p-3`, and an
          empty header would otherwise reserve a blank band above the textarea. */}
      <PromptInputHeader className="p-0">
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
      <PromptInputFooter className="overflow-visible">
        <div ref={toolsRef} className="min-w-0 flex-1 overflow-visible">
          <PromptInputTools className="flex min-w-0 w-full items-center justify-between gap-1 overflow-visible">
            {/* `gap-3` separates control groups; the tighter `gap-1` inside each
                group is owned by the group itself. */}
            <div className="flex min-w-0 items-center gap-3 overflow-visible">
              {toolToggles}

              {!useCondensedLayout && useSpeechFriendlyRef && !hideWebMemorySpeechToggles ? (
                <ComposerSpeechChip />
              ) : null}

              {!useCondensedLayout && enableMarkdownInputPreview ? <ComposerPreviewChip /> : null}

              {showComposerModelHint ? (
                <FeatureHint id="composer-auto-model">
                  <ComposerModelEffortSelect />
                </FeatureHint>
              ) : (
                <ComposerModelEffortSelect />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {attachmentActions}
              {composerSettingsMenu}
            </div>
          </PromptInputTools>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {steerButton}
          {submitControl}
        </div>
      </PromptInputFooter>
    </PromptInput>
  );

  const shell = !useMemories ? (
    composer
  ) : (
    <HomeComposerLumenShell className="core-input-memory-lumen">{composer}</HomeComposerLumenShell>
  );

  return <CoreInputControlsProvider value={controlsValue}>{shell}</CoreInputControlsProvider>;
};

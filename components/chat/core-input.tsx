"use client";

import {
  ChangeEventHandler,
  ComponentProps,
  FormEvent,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
  MouseEvent,
  useLayoutEffect,
} from "react";
import { flushSync } from "react-dom";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  BrainCircuit,
  Eye,
  GlobeIcon,
  Loader2,
  Pencil,
  SquareIcon,
  Volume2,
  XIcon,
} from "lucide-react";
import { ChatStatus } from "ai";
import { motion } from "framer-motion";

import { InputGroupButton } from "../third-party/ui/input-group";
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
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from "../third-party/ai-elements/prompt-input";
import ShinyText from "../ShinyText";

import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ComposerAddFilesButton } from "./composer-add-files-button";
import { ComposerMicButton } from "./composer-mic-button";
import { ComposerToolChip } from "./composer-tool-chip";
import { ModelZdrIndicator } from "./model-zdr-indicator";

import { FeatureHint } from "@/components/onboarding/feature-hint";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COMPOSER_MEMORIES,
  DEFAULT_COMPOSER_MODEL,
  DEFAULT_COMPOSER_WEB_SEARCH,
} from "@/lib/chat/composer-tool-defaults";
import { ChatModel, ChatModels } from "@/lib/schemas/chat";
import { deleteEmptyChat } from "@/data/supabase/chat";
import { useSharedChatContext } from "@/lib/context/chat-context";

type CoreInputProps = {
  modelRef: React.RefObject<ChatModel>;
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
};

/** Max length for the in-flight shimmer copy (matches AiInputForm). */
const SENT_MESSAGE_DISPLAY_MAX = 2000;

function truncateSentMessageDisplay(raw: string): string {
  const t = raw.trim() === "" ? " " : raw.trim();

  return t.length > SENT_MESSAGE_DISPLAY_MAX ? `${t.slice(0, SENT_MESSAGE_DISPLAY_MAX)}\u2026` : t;
}

export const CoreInput: React.FC<CoreInputProps> = ({
  modelRef,
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
}) => {
  const { refreshSidebarChats } = useSharedChatContext();

  const modelStorageKey = modelLocalStorageKey ?? "organic-llm-selected-model";
  const memoriesStorageKey = memoryLocalStorageKey ?? "organic-llm-memories";
  const STORAGE_KEY_WEB_SEARCH = "organic-llm-web-search";
  const STORAGE_KEY_SPEECH_FRIENDLY = "organic-llm-speech-friendly";
  const STORAGE_KEY_TIMESTAMP = "organic-llm-prefs-timestamp";
  const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  const [text, setText] = useState<string>("");
  const [recentlySentText, setRecentlySentText] = useState<string>(""); // For failed/aborted sends
  const recentlySentTextRef = useRef<string>(""); // So restore effect sees value before state flushes
  const [model, setModel] = useState<ChatModel>(defaultModel);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(defaultWebSearch);
  const [useMemories, setUseMemories] = useState<boolean>(defaultMemories);
  const [useSpeechFriendly, setUseSpeechFriendly] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const showLabelsRef = useRef(false);
  const [showLabels, setShowLabels] = useState(false);
  const [inputMarkdownMode, setInputMarkdownMode] = useState<"edit" | "preview">("edit");
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

  // Load preferences from localStorage on mount
  useLayoutEffect(() => {
    if (hasLoadedPrefs.current) return;
    hasLoadedPrefs.current = true;

    const timestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
    const isExpired = !timestamp || Date.now() - parseInt(timestamp, 10) > EXPIRY_MS;

    if (isExpired) {
      // Clear expired preferences
      localStorage.removeItem(modelStorageKey);
      localStorage.removeItem(memoriesStorageKey);
      localStorage.removeItem(STORAGE_KEY_WEB_SEARCH);
      localStorage.removeItem(STORAGE_KEY_SPEECH_FRIENDLY);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);

      setUseWebSearch(defaultWebSearch);
      setUseMemories(defaultMemories);
      if (modelRef) modelRef.current = defaultModel;

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
  }, [
    defaultMemories,
    defaultModel,
    defaultWebSearch,
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

    const applyWidth = (width: number) => {
      const next = showLabelsRef.current
        ? width >= HIDE_LABELS_AT_PX
        : width >= SHOW_LABELS_AT_PX;

      if (next === showLabelsRef.current) return;

      showLabelsRef.current = next;
      setShowLabels(next);
    };

    const measureTarget =
      (el.closest("[data-prompt-input-shell]") as HTMLElement | null) ?? el;

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
  };

  const handleModelSelection = (id: string) => {
    // Find the model object from ChatModels array with matching id
    const selectedModel = ChatModels.find((modelObj) => modelObj.id === id);

    if (selectedModel) setModel(selectedModel);
  };

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
          <ShinyText
            as="div"
            className={composerBodyMeasureClass}
            text={sentDisplayText}
          />
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
    featureHints && !hideWebMemorySpeechToggles && variant !== "compact";
  const showComposerModelHint = featureHints && variant !== "compact";
  const showSteerHint = featureHints && Boolean(onSecondarySubmit);

  return (
    <PromptInput
      aria-busy={showSentShimmer ? true : undefined}
      data-dim-background
      globalDrop
      multiple
      className={cn("z-40 w-full min-w-0", className)}
      onSubmit={handleSubmit}
    >
      <PromptInputHeader>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
      </PromptInputHeader>

      <PromptInputBody>{renderComposerBody()}</PromptInputBody>
      <PromptInputFooter className="overflow-visible">
        <div ref={toolsRef} className="w-full overflow-visible">
          <PromptInputTools className="flex justify-between w-full overflow-visible">
            <div className="flex gap-1 overflow-visible">
              {enableMarkdownInputPreview && (
                <ComposerToolChip
                  active={inputMarkdownMode === "preview"}
                  aria-label={
                    inputMarkdownMode === "edit" ? "Show markdown preview" : "Back to editing"
                  }
                  title={
                    inputMarkdownMode === "edit" ? "Show rendered markdown" : "Edit as plain text"
                  }
                  tool="preview"
                  onClick={() => setInputMarkdownMode((m) => (m === "edit" ? "preview" : "edit"))}
                >
                  {inputMarkdownMode === "edit" ? (
                    <Eye className="size-4" />
                  ) : (
                    <Pencil className="size-4" />
                  )}
                  <span className={cn(showLabels ? "inline-flex" : "hidden")}>
                    {inputMarkdownMode === "edit" ? "Preview" : "Edit"}
                  </span>
                </ComposerToolChip>
              )}
              {!hideWebMemorySpeechToggles && variant !== "compact" ? (
                <>
                  {showComposerToolHints ? (
                    <FeatureHint id="composer-search-memory">
                      <span className="inline-flex gap-1">
                        <ComposerToolChip
                          active={useWebSearch}
                          tool="search"
                          onClick={() => setUseWebSearch(!useWebSearch)}
                        >
                          <GlobeIcon size={16} />
                          <span className={cn(showLabels ? "inline-flex" : "hidden")}>Search</span>
                        </ComposerToolChip>
                        <ComposerToolChip
                          active={useMemories}
                          tool="memory"
                          onClick={() => setUseMemories(!useMemories)}
                        >
                          <BrainCircuit />
                          <span className={cn(showLabels ? "inline-flex" : "hidden")}>Memory</span>
                        </ComposerToolChip>
                      </span>
                    </FeatureHint>
                  ) : (
                    <>
                      <ComposerToolChip
                        active={useWebSearch}
                        tool="search"
                        onClick={() => setUseWebSearch(!useWebSearch)}
                      >
                        <GlobeIcon size={16} />
                        <span className={cn(showLabels ? "inline-flex" : "hidden")}>Search</span>
                      </ComposerToolChip>
                      <ComposerToolChip
                        active={useMemories}
                        tool="memory"
                        onClick={() => setUseMemories(!useMemories)}
                      >
                        <BrainCircuit />
                        <span className={cn(showLabels ? "inline-flex" : "hidden")}>Memory</span>
                      </ComposerToolChip>
                    </>
                  )}
                  {useSpeechFriendlyRef && (
                    <ComposerToolChip
                      active={useSpeechFriendly}
                      aria-label={useSpeechFriendly ? "Speech-friendly on" : "Speech-friendly off"}
                      title="Format replies for reading and TTS; a separate pipeline converts to speech-friendly script."
                      tool="speech"
                      onClick={() => setUseSpeechFriendly(!useSpeechFriendly)}
                    >
                      <Volume2 size={16} />
                      <span className={cn(showLabels ? "inline-flex" : "hidden")}>Speech</span>
                    </ComposerToolChip>
                  )}
                </>
              ) : null}

              {variant !== "compact" ? (
                showComposerModelHint ? (
                  <FeatureHint id="composer-auto-model">
                    <PromptInputSelect
                      required
                      defaultValue={model.id}
                      value={model.id}
                      onValueChange={handleModelSelection}
                    >
                      <PromptInputSelectTrigger className="flex-1 max-w-32 sm:max-w-48 min-w-0">
                        <PromptInputSelectValue className="truncate min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{model.name}</span>
                            {model.supportsZeroDataRetention && <ModelZdrIndicator />}
                          </span>
                        </PromptInputSelectValue>
                      </PromptInputSelectTrigger>
                      <PromptInputSelectContent
                        className="max-h-80 overflow-y-auto"
                        defaultValue={model.id}
                      >
                        {ChatModels.map((model) => (
                          <PromptInputSelectItem
                            key={model.id}
                            textValue={model.name}
                            value={model.id}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate">{model.name}</span>
                              {model.supportsZeroDataRetention && <ModelZdrIndicator />}
                            </span>
                          </PromptInputSelectItem>
                        ))}
                      </PromptInputSelectContent>
                    </PromptInputSelect>
                  </FeatureHint>
                ) : (
                  <PromptInputSelect
                    required
                    defaultValue={model.id}
                    value={model.id}
                    onValueChange={handleModelSelection}
                  >
                    <PromptInputSelectTrigger className="flex-1 max-w-32 sm:max-w-48 min-w-0">
                      <PromptInputSelectValue className="truncate min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{model.name}</span>
                          {model.supportsZeroDataRetention && <ModelZdrIndicator />}
                        </span>
                      </PromptInputSelectValue>
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent
                      className="max-h-80 overflow-y-auto"
                      defaultValue={model.id}
                    >
                      {ChatModels.map((model) => (
                        <PromptInputSelectItem key={model.id} textValue={model.name} value={model.id}>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{model.name}</span>
                            {model.supportsZeroDataRetention && <ModelZdrIndicator />}
                          </span>
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                )
              ) : (
                <span className="text-muted-foreground truncate px-2 text-xs">{model.name}</span>
              )}
            </div>
            <div className="flex gap-1">
              <ComposerAddFilesButton />
              {(!enableMarkdownInputPreview || inputMarkdownMode === "edit") && (
                <ComposerMicButton textareaRef={textareaRef} onTranscriptionChange={setText} />
              )}
            </div>
          </PromptInputTools>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onSecondarySubmit ? (
            (() => {
              const steerButton = (
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
                  {steerButton}
                </FeatureHint>
              ) : (
                steerButton
              );
            })()
          ) : null}
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
        </div>
      </PromptInputFooter>
    </PromptInput>
  );
};

type OrganicSubmitState = "idle" | "ready" | "sent" | "awaiting" | "error";

function OrganicSubmitGlyph({ state }: { state: OrganicSubmitState }) {
  const label = {
    idle: "Idle",
    ready: "Ready to send",
    sent: "Sent",
    awaiting: "Awaiting completion",
    error: "Error",
  }[state];

  return (
    <motion.svg
      aria-label={label}
      className="size-4"
      fill="none"
      initial={false}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {state === "idle" ? (
        <motion.g
          key="idle"
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.82 }}
          transition={{ duration: 0.18 }}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 5v1.5M12 17.5V19M5 12h1.5M17.5 12H19" opacity="0.55" />
        </motion.g>
      ) : null}
      {state === "ready" ? (
        <motion.path
          key="ready"
          animate={{ opacity: 1, pathLength: 1, y: 0 }}
          d="M12 19V5m0 0-6 6m6-6 6 6"
          initial={{ opacity: 0, pathLength: 0, y: 2 }}
          transition={{ duration: 0.22 }}
        />
      ) : null}
      {state === "sent" ? (
        <motion.path
          key="sent"
          animate={{ opacity: 1, pathLength: 1, scale: 1 }}
          d="m5 12 4 4L19 6"
          initial={{ opacity: 0, pathLength: 0, scale: 0.9 }}
          transition={{ duration: 0.24 }}
        />
      ) : null}
      {state === "awaiting" ? (
        <motion.g
          key="awaiting"
          animate={{ rotate: 360 }}
          initial={{ opacity: 0.9 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        >
          <path d="M12 4a8 8 0 0 1 8 8" />
          <path d="M20 12a8 8 0 0 1-8 8" opacity="0.45" />
          <circle cx="12" cy="12" r="2.5" />
        </motion.g>
      ) : null}
      {state === "error" ? (
        <motion.g
          key="error"
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.18 }}
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </motion.g>
      ) : null}
    </motion.svg>
  );
}

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  stop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  children,
  stop,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <ArrowUp className="size-4" />;

  if (status === "submitted" || status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (stop && (status === "streaming" || status === "submitted")) {
        e.preventDefault();
        stop();
      }
    },
    [stop, status]
  );

  return (
    // TODO: Could make cursor more fun for this specific element
    <motion.div
      className="inline-block cursor-pointer"
      whileHover={{ scale: 1.09 }}
      whileTap={{ scale: 0.93 }}
    >
      <InputGroupButton
        aria-label={status === "ready" ? "Submit" : "Abort"}
        className={cn(className)}
        size={size}
        type={status === "ready" ? "submit" : "button"}
        variant={variant}
        {...props}
        onClick={handleClick}
      >
        {children ?? Icon}
      </InputGroupButton>
    </motion.div>
  );
};

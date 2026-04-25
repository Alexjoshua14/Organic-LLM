"use client";

import {
  ChangeEventHandler,
  ComponentProps,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  MouseEvent,
  useLayoutEffect,
} from "react";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  BrainCircuit,
  Eye,
  GlobeIcon,
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
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSpeechButton,
} from "../third-party/ai-elements/prompt-input";

import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ModelZdrIndicator } from "./model-zdr-indicator";

import { cn } from "@/lib/utils";
import { ChatModel, ChatModels, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
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
};

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
}) => {
  const { refreshSidebarChats } = useSharedChatContext();

  const STORAGE_KEY_MODEL = "organic-llm-selected-model";
  const STORAGE_KEY_WEB_SEARCH = "organic-llm-web-search";
  const STORAGE_KEY_MEMORIES = "organic-llm-memories";
  const STORAGE_KEY_SPEECH_FRIENDLY = "organic-llm-speech-friendly";
  const STORAGE_KEY_TIMESTAMP = "organic-llm-prefs-timestamp";
  const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  const [text, setText] = useState<string>("");
  const [recentlySentText, setRecentlySentText] = useState<string>(""); // For failed/aborted sends
  const recentlySentTextRef = useRef<string>(""); // So restore effect sees value before state flushes
  const [model, setModel] = useState<ChatModel>(DEFAULT_CHAT_MODEL);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [useMemories, setUseMemories] = useState<boolean>(false);
  const [useSpeechFriendly, setUseSpeechFriendly] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [inputMarkdownMode, setInputMarkdownMode] = useState<"edit" | "preview">("edit");
  const hasLoadedPrefs = useRef(false);
  const appliedInitialDraft = useRef(false);

  // Refs for unmount cleanup: must see latest values when component unmounts
  const inputEmptyRef = useRef(false);
  const statusRef = useRef<typeof status>("ready");

  inputEmptyRef.current = text.trim() === "";
  statusRef.current = status ?? "ready";

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

  // Load preferences from localStorage on mount
  useLayoutEffect(() => {
    if (hasLoadedPrefs.current) return;
    hasLoadedPrefs.current = true;

    const timestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
    const isExpired = !timestamp || Date.now() - parseInt(timestamp, 10) > EXPIRY_MS;

    if (isExpired) {
      // Clear expired preferences
      localStorage.removeItem(STORAGE_KEY_MODEL);
      localStorage.removeItem(STORAGE_KEY_WEB_SEARCH);
      localStorage.removeItem(STORAGE_KEY_MEMORIES);
      localStorage.removeItem(STORAGE_KEY_SPEECH_FRIENDLY);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);

      return;
    }

    // Load stored preferences
    const storedModel = localStorage.getItem(STORAGE_KEY_MODEL);

    if (storedModel) {
      const found = ChatModels.find((m) => m.id === storedModel);

      if (found) setModel(found);
    }

    const storedWebSearch = localStorage.getItem(STORAGE_KEY_WEB_SEARCH);

    if (storedWebSearch === "true") setUseWebSearch(true);

    const storedMemories = localStorage.getItem(STORAGE_KEY_MEMORIES);

    if (storedMemories === "true") setUseMemories(true);

    const storedSpeechFriendly = localStorage.getItem(STORAGE_KEY_SPEECH_FRIENDLY);

    if (storedSpeechFriendly === "true") setUseSpeechFriendly(true);
  }, []);

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
      localStorage.setItem(STORAGE_KEY_MODEL, model.id);
      updatePrefsTimestamp();
    }
  }, [model, modelRef]);

  // Sync web search to ref and persist to localStorage
  useEffect(() => {
    if (useWebSearchRef && useWebSearchRef.current !== useWebSearch) {
      useWebSearchRef.current = useWebSearch;
    }
    if (hasLoadedPrefs.current) {
      localStorage.setItem(STORAGE_KEY_WEB_SEARCH, String(useWebSearch));
      updatePrefsTimestamp();
    }
  }, [useWebSearch, useWebSearchRef]);

  // Sync memories to ref and persist to localStorage
  useEffect(() => {
    if (useMemoriesRef && useMemoriesRef.current !== useMemories) {
      useMemoriesRef.current = useMemories;
    }
    if (hasLoadedPrefs.current) {
      localStorage.setItem(STORAGE_KEY_MEMORIES, String(useMemories));
      updatePrefsTimestamp();
    }
  }, [useMemories, useMemoriesRef]);

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

    const update = (width: number) => setShowLabels(width >= 628);

    update(el.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      update(entries[0]?.contentRect.width ?? 0);
    });

    observer.observe(el);

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

    sendMessage({
      text: finalText,
      files: message.files,
    });
    setText("");
    if (enableMarkdownInputPreview) {
      setInputMarkdownMode("edit");
    }
  };

  const handleModelSelection = (id: string) => {
    // Find the model object from ChatModels array with matching id
    const selectedModel = ChatModels.find((modelObj) => modelObj.id === id);

    if (selectedModel) setModel(selectedModel);
  };

  const handleInputChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback((e) => {
    setText(e.target.value);
  }, []);

  return (
    <PromptInput
      globalDrop
      multiple
      className={cn("min-w-fit z-40", className)}
      onSubmit={handleSubmit}
    >
      <PromptInputHeader>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
      </PromptInputHeader>

      <PromptInputBody>
        {enableMarkdownInputPreview && inputMarkdownMode === "preview" ? (
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
        ) : (
          <PromptInputTextarea
            ref={textareaRef}
            value={text}
            onChange={handleInputChange}
          />
        )}
      </PromptInputBody>
      <PromptInputFooter>
        <div ref={toolsRef} className="w-full">
          <PromptInputTools className="flex justify-between w-full">
            <div className="flex gap-1">
              {enableMarkdownInputPreview && (
                <PromptInputButton
                  aria-label={
                    inputMarkdownMode === "edit" ? "Show markdown preview" : "Back to editing"
                  }
                  aria-pressed={inputMarkdownMode === "preview"}
                  size={"dynamic-sm"}
                  title={
                    inputMarkdownMode === "edit"
                      ? "Show rendered markdown"
                      : "Edit as plain text"
                  }
                  variant={inputMarkdownMode === "preview" ? "default" : "ghost"}
                  onClick={() =>
                    setInputMarkdownMode((m) => (m === "edit" ? "preview" : "edit"))
                  }
                >
                  {inputMarkdownMode === "edit" ? (
                    <Eye className="size-4" />
                  ) : (
                    <Pencil className="size-4" />
                  )}
                  <span className={cn(showLabels ? "inline-flex" : "hidden")}>
                    {inputMarkdownMode === "edit" ? "Preview" : "Edit"}
                  </span>
                </PromptInputButton>
              )}
              {!hideWebMemorySpeechToggles ? (
                <>
                  <PromptInputButton
                    size={"dynamic-sm"}
                    variant={useWebSearch ? "default" : "ghost"}
                    onClick={() => setUseWebSearch(!useWebSearch)}
                  >
                    <GlobeIcon size={16} />
                    <span className={cn(showLabels ? "inline-flex" : "hidden")}>Search</span>
                  </PromptInputButton>
                  <PromptInputButton
                    size={"dynamic-sm"}
                    variant={useMemories ? "default" : "ghost"}
                    onClick={() => setUseMemories(!useMemories)}
                  >
                    <BrainCircuit />
                    <span className={cn(showLabels ? "inline-flex" : "hidden")}>Memory</span>
                  </PromptInputButton>
                  {useSpeechFriendlyRef && (
                    <PromptInputButton
                      aria-label={useSpeechFriendly ? "Speech-friendly on" : "Speech-friendly off"}
                      size={"dynamic-sm"}
                      title="Format replies for reading and TTS; a separate pipeline converts to speech-friendly script."
                      variant={useSpeechFriendly ? "default" : "ghost"}
                      onClick={() => setUseSpeechFriendly(!useSpeechFriendly)}
                    >
                      <Volume2 size={16} />
                      <span className={cn(showLabels ? "inline-flex" : "hidden")}>Speech</span>
                    </PromptInputButton>
                  )}
                </>
              ) : null}

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
            </div>
            <div className="flex gap-1">
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              {(!enableMarkdownInputPreview || inputMarkdownMode === "edit") && (
                <PromptInputSpeechButton textareaRef={textareaRef} onTranscriptionChange={setText} />
              )}
            </div>
          </PromptInputTools>
        </div>
        <PromptInputSubmit disabled={(!text && !status) || disabled} status={status} stop={stop} />
      </PromptInputFooter>
    </PromptInput>
  );
};

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

'use client'

import { ChangeEventHandler, ComponentProps, FormEvent, useCallback, useEffect, useRef, useState, MouseEvent } from 'react'
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
  PromptInputCommandGroup,
} from "../ai-elements/prompt-input";
import { useChat } from '@ai-sdk/react';
import { ArrowUp, ArrowUpNarrowWideIcon, BrainCircuit, CornerDownLeftIcon, GlobeIcon, Loader2Icon, SquareIcon, XIcon } from 'lucide-react';
import { ChatModel, ChatModels, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { ChatStatus } from 'ai';
import { InputGroupButton } from '../third-party/ui/input-group';
import { cn } from '@/lib/utils'
import { motion } from "framer-motion";

type NewChatInputProps = {
  modelRef: React.RefObject<ChatModel>,
  useWebSearchRef: React.RefObject<boolean>,
  useMemoriesRef: React.RefObject<boolean>,
  sendMessage: ReturnType<typeof useChat>["sendMessage"],
  stop: ReturnType<typeof useChat>["stop"],
  status: ReturnType<typeof useChat>["status"],
  className?: string;
};

export const NewChatInput: React.FC<NewChatInputProps> = ({
  modelRef,
  useWebSearchRef,
  useMemoriesRef,
  sendMessage,
  stop,
  status,
  className,
}) => {

  const [text, setText] = useState<string>('');
  const [model, setModel] = useState<ChatModel>(DEFAULT_CHAT_MODEL);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [useMemories, setUseMemories] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  // Set refs when any of the values change, so they are current for next send
  useEffect(() => {
    if (modelRef && modelRef.current !== model) {
      modelRef.current = model;
    }
  }, [model, modelRef]);

  useEffect(() => {
    if (useWebSearchRef && useWebSearchRef.current !== useWebSearch) {
      useWebSearchRef.current = useWebSearch;
    }
  }, [useWebSearch, useWebSearchRef]);

  useEffect(() => {
    if (useMemoriesRef && useMemoriesRef.current !== useMemories) {
      useMemoriesRef.current = useMemories;
    }
  }, [useMemories, useMemoriesRef]);

  useEffect(() => {
    const el = toolsRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      // Toggle labels based on available width, not viewport breakpoint
      setShowLabels(width >= 360);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);


  const handleSubmit = (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasText = Boolean(message.text.trim());
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage({
      text: message.text || 'Sent with attachments',
      files: message.files
    });
    setText('');
  };

  const handleModelSelection = (id: string) => {
    // Find the model object from ChatModels array with matching id
    const selectedModel = ChatModels.find((modelObj) => modelObj.id === id);

    if (selectedModel)
      setModel(selectedModel)
  }

  const handleInputChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback((e) => {
    setText(e.target.value);
  }, []);

  return (
    <PromptInput onSubmit={handleSubmit} globalDrop multiple className={cn("min-w-fit", className)}>
      <PromptInputHeader>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
      </PromptInputHeader>

      <PromptInputBody>
        <PromptInputTextarea
          onChange={handleInputChange}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <div ref={toolsRef} className="w-full">
          <PromptInputTools className="flex justify-between w-full">
            <div className="flex gap-1">
              <PromptInputButton
                onClick={() => setUseWebSearch(!useWebSearch)}
                variant={useWebSearch ? 'default' : 'ghost'}
                size={'dynamic-sm'}
              >
                <GlobeIcon size={16} />
                <span className={cn(showLabels ? "inline-flex" : "hidden")}>Search</span>
              </PromptInputButton>
              <PromptInputButton
                onClick={() => setUseMemories(!useMemories)}
                variant={useMemories ? 'default' : 'ghost'}
                size={'dynamic-sm'}
              >
                <BrainCircuit />
                <span className={cn(showLabels ? "inline-flex" : "hidden")}>Memory</span>
              </PromptInputButton>

              <PromptInputSelect
                defaultValue={DEFAULT_CHAT_MODEL.id}
                onValueChange={handleModelSelection}
                value={model.id}
                required
              >
                <PromptInputSelectTrigger className="max-w-32 min-w-0">
                  <PromptInputSelectValue className="truncate min-w-0" />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent defaultValue={DEFAULT_CHAT_MODEL.id}>
                  {ChatModels.map((model) => (
                    <PromptInputSelectItem key={model.id} value={model.id}>
                      {model.name}
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
              <PromptInputSpeechButton
                onTranscriptionChange={setText}
                textareaRef={textareaRef}
              />
            </div>
          </PromptInputTools>
        </div>
        <PromptInputSubmit disabled={!text && !status} status={status} stop={stop} />
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

  if (status === "submitted" || status === 'streaming') {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (stop && (status === 'streaming' || status === 'submitted')) {
      e.preventDefault()
      stop()
    }
  }, [stop, status])

  return (
    // TODO: Could make cursor more fun for this specific element
    <motion.div
      whileTap={{ scale: 0.93 }}
      whileHover={{ scale: 1.09 }}
      className="inline-block cursor-pointer"
    >
      <InputGroupButton
        aria-label={status === 'ready' ? "Submit" : "Abort"}
        className={cn(className)}
        size={size}
        type={status === 'ready' ? "submit" : "button"}
        variant={variant}
        {...props}
        onClick={handleClick}
      >
        {children ?? Icon}
      </InputGroupButton>
    </motion.div>
  );
};
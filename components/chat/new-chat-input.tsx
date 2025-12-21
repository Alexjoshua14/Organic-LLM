'use client'

import { ChangeEventHandler, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
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
  PromptInputSubmit
} from "../ai-elements/prompt-input";
import { useChat } from '@ai-sdk/react';
import { BrainCircuit, GlobeIcon } from 'lucide-react';
import { ChatModel, ChatModels, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";


type NewChatInputProps = {
  modelRef: React.RefObject<ChatModel>,
  useWebSearchRef: React.RefObject<boolean>,
  useMemoriesRef: React.RefObject<boolean>,
  sendMessage: ReturnType<typeof useChat>["sendMessage"],
  stop: ReturnType<typeof useChat>["stop"],
  status: ReturnType<typeof useChat>["status"],
};

export const NewChatInput: React.FC<NewChatInputProps> = ({
  modelRef,
  useWebSearchRef,
  useMemoriesRef,
  sendMessage,
  stop,
  status,
}) => {

  const [text, setText] = useState<string>('');
  const [model, setModel] = useState<ChatModel>(DEFAULT_CHAT_MODEL);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [useMemories, setUseMemories] = useState<boolean>(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <PromptInput onSubmit={handleSubmit} globalDrop multiple className="max-w-xl md:max-w-2xl">
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
        <PromptInputTools>
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
          <PromptInputButton
            onClick={() => setUseWebSearch(!useWebSearch)}
            variant={useWebSearch ? 'default' : 'ghost'}
          >
            <GlobeIcon size={16} />
            <span>Search</span>
          </PromptInputButton>
          <PromptInputButton
            onClick={() => setUseMemories(!useMemories)}
            variant={useMemories ? 'default' : 'ghost'}
          >
            <BrainCircuit />
            <span>Memory</span>
          </PromptInputButton>
          <PromptInputSelect
            defaultValue={DEFAULT_CHAT_MODEL.id}
            onValueChange={handleModelSelection}
            value={model.id}
            required
          >
            <PromptInputSelectTrigger>
              <PromptInputSelectValue />
            </PromptInputSelectTrigger>
            <PromptInputSelectContent defaultValue={DEFAULT_CHAT_MODEL.id}>
              {ChatModels.map((model) => (
                <PromptInputSelectItem key={model.id} value={model.id}>
                  {model.name}
                </PromptInputSelectItem>
              ))}
            </PromptInputSelectContent>
          </PromptInputSelect>
        </PromptInputTools>
        <PromptInputSubmit disabled={!text && !status} status={status} />
      </PromptInputFooter>
    </PromptInput>
  );
};

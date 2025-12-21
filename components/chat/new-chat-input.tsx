'use clietn'

import { ChangeEventHandler, FormEvent, useCallback, useRef, useState } from 'react'
import { PromptInput, PromptInputHeader, PromptInputAttachments, PromptInputAttachment, PromptInputBody, PromptInputMessage, PromptInputTextarea, PromptInputTools, PromptInputActionAddAttachments, PromptInputActionMenu, PromptInputActionMenuContent, PromptInputActionMenuTrigger, PromptInputButton, PromptInputFooter, PromptInputSelect, PromptInputSelectContent, PromptInputSelectItem, PromptInputSelectTrigger, PromptInputSelectValue, PromptInputSpeechButton, PromptInputSubmit } from "../ai-elements/prompt-input";
import { useSharedChatContext } from '@/lib/context/chat-context';
import { useChat } from '@ai-sdk/react';
import { BrainCircuit, GlobeIcon } from 'lucide-react';
import { ChatModels } from "@/lib/schemas/chat";
import { DefaultChatTransport } from 'ai';


type NewChatInputProps = {

};

export const NewChatInput: React.FC<NewChatInputProps> = ({

}) => {

  const [text, setText] = useState<string>('');
  const [model, setModel] = useState<string>();
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [useMemories, setUseMemories] = useState<boolean>(true);
  const [inputError, setError] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chat = useSharedChatContext()

  const { sendMessage, stop, status, error, setMessages } = useChat({
    id: chat.chatId,
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest({ messages, id }) {
        return {
          body: {
            message: messages[messages.length - 1],
            id,
            model: model
          },
        };
      },
    }),
  })


  const handleSubmit = (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasText = Boolean(message.text.trim());
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      setError(true)
      return;
    }

    sendMessage(
      {
        text: message.text || 'Sent with attachments',
        files: message.files
      },
      {
        body: {
          model: model,
          webSearch: useWebSearch,
          useMemories: useMemories,
        },
      },
    );
    setText('');
  };

  const handleInputChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback((e) => {
    setText(e.target.value);
    if (error && e.target.value.trim().length > 0) {
      setError(false);
    }
  }, []);



  /**
   * Handle certain keyboard events:
   *  1. Send message on `Enter`
   */
  // const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
  //   (e) => {
  //     if (e.key === "Enter" && !e.shiftKey) {
  //       e.preventDefault();
  //       handleSubmit();
  //     }
  //   }, []
  // )

  return (
    <PromptInput onSubmit={handleSubmit} globalDrop multiple>
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
            onValueChange={(value) => {
              setModel(value);
            }}
            value={model}
          >
            <PromptInputSelectTrigger>
              <PromptInputSelectValue />
            </PromptInputSelectTrigger>
            <PromptInputSelectContent>
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

import React, { ChangeEventHandler, FormEvent, useCallback, useState } from "react";
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputMessage } from "../ai-elements/prompt-input";
import { PromptInputSubmit } from "../chat/new-chat-input";
import { glass } from "../design-system/primitives";

export interface AiInputFormProps extends Omit<React.HTMLAttributes<HTMLFormElement>, "onSubmit"> {
  onSubmit: (prompt: string) => void | Promise<void>;
  isLoading?: boolean;
  className?: string;
}

/**
 * AI Input Form for one-off prompts that route users to different parts of Organic LLM.
 * This is NOT a chat interface - it's for single prompts that trigger routing/actions.
 */
export const AiInputForm: React.FC<AiInputFormProps> = ({
  onSubmit,
  isLoading = false,
  className,
  ...props
}) => {
  const [text, setText] = useState<string>('');

  const handleSubmit = async (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasText = Boolean(message.text.trim());

    if (!hasText || isLoading) {
      return;
    }

    await onSubmit(message.text);
    setText('');
  };

  const handleInputChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback((e) => {
    setText(e.target.value);
  }, []);

  return (
    <PromptInput onSubmit={handleSubmit} multiple className={className}>
      <PromptInputBody>
        <PromptInputTextarea
          onChange={handleInputChange}
          value={text}
          disabled={isLoading}
          placeholder="What do you want to explore?"
          className="text-lg! md:text-lg! placeholder:text-lg! caret-accent"
          autoFocus
        />
      </PromptInputBody>
      <PromptInputFooter className="flex justify-end">
        <PromptInputSubmit
          disabled={!text.trim() || isLoading}
        />
      </PromptInputFooter>
    </PromptInput>
  );
};

AiInputForm.displayName = "AiInputForm";

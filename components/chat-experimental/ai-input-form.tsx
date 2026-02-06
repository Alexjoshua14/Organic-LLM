import React, { FormEvent, useEffect, useState } from "react";
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputMessage, PromptInputProvider, usePromptInputController } from "../third-party/ai-elements/prompt-input";
import { PromptInputSubmit } from "../chat/new-chat-input";
import { glass } from "../design-system/primitives";
import { ChatStatus } from "ai";
import ShinyText from "../ShinyText";

export interface AiInputFormProps extends Omit<React.HTMLAttributes<HTMLFormElement>, "onSubmit"> {
  onSubmit: (prompt: string) => void | Promise<void>;
  isLoading?: boolean;
  status?: ChatStatus;
  className?: string;
}

/** Max length to display in the "preserved" state to avoid layout/performance issues; full text is still sent. */
const DISPLAY_MAX_LENGTH = 2000;

const AiInputFormContent: React.FC<AiInputFormProps> = ({
  onSubmit,
  isLoading = false,
  className,
  status,
  ...props
}) => {
  const { textInput } = usePromptInputController();
  const [userQuery, setUserQuery] = useState<string>("");

  // Clear preserved text when we return to ready so we don't show stale content
  useEffect(() => {
    if (status === "ready") {
      setUserQuery("");
    }
  }, [status]);

  const handleSubmit = async (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasText = Boolean(message.text.trim());

    if (!hasText || isLoading) {
      return;
    }
    // Preserve exactly what the user typed for display (React will escape on render — no innerHTML)
    setUserQuery(message.text);

    await onSubmit(message.text);
    textInput.clear();
  };

  // Safe display: React escapes {text}; truncate only for layout, not for security
  const displayText =
    userQuery.length > DISPLAY_MAX_LENGTH
      ? `${userQuery.slice(0, DISPLAY_MAX_LENGTH)}\u2026`
      : userQuery || " ";

  return (
    <PromptInput onSubmit={handleSubmit} multiple className={className}>
      <PromptInputBody>

        {status === "ready" ? (
          <PromptInputTextarea
            disabled={isLoading}
            placeholder="What do you want to explore?"
            className="text-lg! md:text-lg! placeholder:text-lg! caret-accent w-full placeholder:text-foreground/80"
            autoFocus
          />
        ) : status === "submitted" || status === "streaming" ? (
          <ShinyText text={displayText} className="w-full h-24 p-4 min-h-24 overflow-auto" />
        ) : (
          <h2 className="text-warning">An error has occured..</h2>
        )}
      </PromptInputBody>
      <PromptInputFooter className="flex justify-end">
        <PromptInputSubmit
          status={status || 'ready'}
          disabled={!textInput.value.trim() || isLoading}
        />
      </PromptInputFooter>
    </PromptInput>
  );
};

/**
 * AI Input Form for one-off prompts that route users to different parts of Organic LLM.
 * This is NOT a chat interface - it's for single prompts that trigger routing/actions.
 */
export const AiInputForm: React.FC<AiInputFormProps> = (props) => {
  return (
    <PromptInputProvider>
      <AiInputFormContent {...props} />
    </PromptInputProvider>
  );
};

AiInputForm.displayName = "AiInputForm";

import { ComponentProps, FC } from "react";

import ShinyText from "../ShinyText";

const TEXT_ANIMATION_SPEED = 1.2;

export const ChatLoading = () => {
  return (
    <div className="flex gap-2 py-2">
      <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
      <div className="w-2 h-2 rounded-full bg-foreground animate-pulse delay-[667ms]" />
      <div className="w-2 h-2 rounded-full bg-foreground animate-pulse delay-[1333ms]" />
    </div>
  );
};

type ChatThinkingProps = {
  text?: string;
};

export const ChatThinking: FC<
  ChatThinkingProps & Partial<ComponentProps<typeof ShinyText>>
> = ({ text, ...props }) => {
  return (
    <ShinyText
      disabled={false}
      speed={TEXT_ANIMATION_SPEED}
      text={text ?? "Thinking..."}
      {...props}
    />
  );
};

type ChatReasoningProps = {
  text?: string;
};

export const ChatReasoning: FC<
  ChatReasoningProps & Partial<ComponentProps<typeof ShinyText>>
> = ({ text, ...props }) => {
  return (
    <ShinyText
      disabled={false}
      speed={TEXT_ANIMATION_SPEED}
      text={text ?? "Reasoning..."}
      {...props}
    />
  );
};

"use client";

import { Fragment } from "react";
import { Button, ButtonGroup, useButton } from "@heroui/button";
import { Divider } from "@heroui/divider";
import {
  CodeIcon,
  GraduationCapIcon,
  Newspaper,
  NewspaperIcon,
  Sparkle,
  SparkleIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { forwardRef, useCallback } from "react";

type NewChatProps = {
  hidden?: boolean;
};

const chatIdeas: {
  title: string;
  prompt: string;
  icon: React.ReactNode;
}[] = [
  {
    title: "Create",
    prompt: "Help me create something.",
    icon: <SparklesIcon size={14} />,
  },
  {
    title: "Explore",
    prompt: "Help me explore something.",
    icon: <NewspaperIcon size={14} />,
  },
  {
    title: "Code",
    prompt: "Help me code something.",
    icon: <CodeIcon size={14} />,
  },
  {
    title: "Learn",
    prompt: "Help me learn something.",
    icon: <GraduationCapIcon size={14} />,
  },
];

const promptIdeas: {
  title: string;
  prompt: string;
}[] = [
  {
    title: "How does AI work?",
    prompt: "How does AI work?",
  },
  {
    title: "Are white holes real?",
    prompt: "Are white holes real?",
  },
  {
    title: 'How many Bs are in the word "blueberry"?',
    prompt: 'How many Bs are in the word "blueberry"?',
  },
  {
    title: "What is the meaning of chat?",
    prompt: "What is the meaning of chat?",
  },
];

export const NewChat: React.FC<NewChatProps> = ({ hidden }) => {
  const chatGeneratorButton = useCallback((prompt: string) => {
    console.log(prompt);
  }, []);

  return (
    <div className="max-w-xl w-full flex flex-col gap-6 items-start px-8 pt-[calc(max(20vh,2.5rem))] subpixel-antialiased">
      <h1 className="text-3xl font-bold ">How can I help you?</h1>
      <div className="flex gap-2 flex-wrap">
        {chatIdeas.map(({ title, prompt, icon }) => (
          <ChatIdeaButton
            key={title}
            onPress={() => chatGeneratorButton(prompt)}
            title={title}
            icon={icon}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2 w-full">
        {promptIdeas.map(({ title, prompt }, index) => (
          <Fragment key={`${title}-${index}`}>
            <ChatTopicButton
              title={title}
              onPress={() => chatGeneratorButton(prompt)}
            />
            {index < promptIdeas.length - 1 && <Divider />}
          </Fragment>
        ))}
      </div>
    </div>
  );
};

const ChatIdeaButton: React.FC<{
  onPress: () => void;
  title: string;
  icon: React.ReactNode;
}> = ({ onPress, title, icon }) => {
  return (
    <Button
      onPress={onPress}
      className="rounded-full border border-border bg-background-secondary"
    >
      {icon}
      {title}
    </Button>
  );
};

const ChatTopicButton: React.FC<{
  onPress: () => void;
  title: string;
}> = ({ onPress, title }) => {
  return (
    <Button
      variant="light"
      onPress={onPress}
      className="flex justify-start text-primary text-base"
    >
      {title}
    </Button>
  );
};

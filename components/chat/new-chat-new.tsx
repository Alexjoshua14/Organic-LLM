"use client";

import { Fragment, useState } from "react";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import {
  CodeIcon,
  GraduationCapIcon,
  NewspaperIcon,
  SparklesIcon,
} from "lucide-react";
import { useCallback } from "react";
import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("components/chat/new-chat-new.tsx");

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

export const NewChatNew: React.FC<NewChatProps> = ({ hidden: _hidden }) => {
  const [creatingChat, setCreatingChat] = useState(false);

  const chatGeneratorButton = useCallback(async (prompt: string) => {
    // TODO: Handle prompt generation
    // console.log(prompt);

    // Create new chat

    // redirect user to /chat/${newChatID} with initialMessage == prompt

    if (creatingChat) {
      return;
    }

    try {
      setCreatingChat(true);
      const createChatRes = await createChat();

      if (createChatRes.error || createChatRes.data === null) {
        throw createChatRes.error;
      }

      const chatId = createChatRes.data;

      redirect(`/chat/${chatId}?initialMessage=${prompt}`);
    } catch (error) {
      logger.error("chatGeneratorButton", `Error creating chat: ${error}`);
    } finally {
      setCreatingChat(false);
    }
  }, []);

  return (
    <div className="max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl w-full flex flex-col gap-6 items-start px-8 pt-[calc(max(20vh,2.5rem))] subpixel-antialiased">
      <h1 className="text-3xl font-bold ">How can I help you?</h1>
      <div className="flex gap-2 flex-wrap">
        {chatIdeas.map(({ title, prompt, icon }) => (
          <ChatIdeaButton
            key={title}
            icon={icon}
            title={title}
            onPress={() => chatGeneratorButton(prompt)}
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
      className="rounded-full border border-border bg-background-secondary"
      onPress={onPress}
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
      className="flex justify-start text-primary text-base"
      variant="light"
      onPress={onPress}
    >
      {title}
    </Button>
  );
};

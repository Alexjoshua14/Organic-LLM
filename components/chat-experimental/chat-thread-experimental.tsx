"use client";

import { FC, useCallback, useEffect, useState } from "react";
import { UIMessage } from "ai";
import { StickToBottom } from "use-stick-to-bottom";

import { ChatMessagerWrapperExperimental } from "./chat-message-wrapper-experimental";

import { ChatMessage } from "@/components/chat/chat-message";
type ChatThreadProps = {
  messages: UIMessage[];
  variant?: "default" | "compact";
};

/**
 * NOTE:
 * Could copmletely rewire the threads so we have most messages in _history_ variable
 * When a new message comes in, place it into the new message queue
 * Once the message's initial animation completes, use the framer motion onAnimationComplete callback
 * to call a callback function that moves the message from the top of the new message queue to the _history_ list of messages
 * Then the next message in the new message queue would get rendered and this cycle would repeat indefinetely
 *
 * The pros of this:
 *  Enables us to ensure previous messages are never rerendered unnecessarily, we can
 * treat the history list as a append only list of messages, once a message is inside, it can be deleted (maybe)
 * but it can't be updated.
 *
 *  The new message queue allows us to systematically animate new messages, ensuring we don't
 *  have too much happening at once, we animate each message as it enters the thread/view one by one
 *  ensuring the previous message completes its initial animation before moving on to the next
 *
 *  We can also make the onAnimationComplete callback that appends message to history idempotent so that
 *  we can use that callback function for other animations as well without worrying about messages being duplicated to history
 *
 *  When the full page refreshes or we something happens and we rerender everything (losing state), it's perfectly fine
 *  and perhaps desired to just put all 'initialMessages' into the history DS, starting with an empty new message queue.
 *
 *  The minor delay it takes to show messages, 2s for user message to move into chat thread
 *  and then 2 more seconds for AI message to move into chat thread once user message anim completes
 *  provides us a sort of buffer time for AI to start streaming response, something 'useful'/visually interesting is always happening
 */

export const ChatThreadExperimental: FC<ChatThreadProps> = ({ messages, variant = "default" }) => {
  // const { messages } = useChat()
  // NOTE: Might be a better datastructure/feature for history
  const [history, setHistory] = useState<UIMessage[]>([]);
  const [newMessages, setNewMessages] = useState<UIMessage[]>([]);
  const [initialLoad, setInitialLoad] = useState<boolean>(true);

  // Initialize history with existing messages on mount
  useEffect(() => {
    if (initialLoad) {
      setHistory(messages);
      setInitialLoad(false);
    }
  }, [messages, initialLoad]);

  // Handle new messages after initial load
  useEffect(() => {
    if (initialLoad || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const isAlreadyInQueue = newMessages.some((m) => m.id === latestMessage.id);
    const isAlreadyInHistory = history.some((m) => m.id === latestMessage.id);

    if (!isAlreadyInQueue && !isAlreadyInHistory) {
      setNewMessages((prev) => [...prev, latestMessage]);
    } else if (isAlreadyInQueue) {
      // Propogate message update
      setNewMessages((prev) => {
        const index = prev.findIndex((m) => m.id === latestMessage.id);

        if (index !== -1) {
          prev[index] = latestMessage;
        }

        return prev;
      });
    } else if (isAlreadyInHistory) {
      // Propogate message update
      setHistory((prev) => {
        const index = prev.findIndex((m) => m.id === latestMessage.id);

        if (index !== -1) {
          prev[index] = latestMessage;
        }

        return prev;
      });
    }
  }, [messages, newMessages, history, initialLoad]);

  const handleNewMessageToHistoryUpdate = () => {
    let message: UIMessage | null = null;

    setNewMessages((prev) => {
      if (prev.length === 0) return prev;
      message = prev[0];

      return prev.slice(1); // Remove first message immutably
    });

    if (message !== null) {
      setHistory((prev) => [...prev, message!]); // Add to history immutably
    }
  };

  const handleNewMessageAnimationComplete = useCallback((message: UIMessage) => {
    handleNewMessageToHistoryUpdate();
  }, []);

  return (
    <StickToBottom.Content
      className={`w-full mx-auto  flex flex-col gap-2 px-8 pt-20 pb-24 md:pb-40 ${variant === "default" ? "max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl" : "max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl"} `}
    >
      {history.map((message) => {
        // const lastItem = (index === messages.length - 1);
        return <ChatMessage key={message.id} message={message} />;
      })}
      {newMessages[0] && (
        <ChatMessagerWrapperExperimental
          key={`${newMessages[0].id}-wrapper`}
          role={newMessages[0].role}
          onAnimComplete={() => handleNewMessageAnimationComplete(newMessages[0])}
        >
          <ChatMessage key={newMessages[0].id} message={newMessages[0]} />
        </ChatMessagerWrapperExperimental>
      )}
    </StickToBottom.Content>
  );
};

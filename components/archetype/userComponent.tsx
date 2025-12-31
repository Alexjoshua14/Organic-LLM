'use client'

import React, { useEffect, useRef } from "react";
import { Textarea } from "@/components/third-party/ui/textarea";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { useSharedAIContext } from "@/hooks/use-ai-shared-context";

type UserComponentProps = {
  message?: string;
};

const UserComponent: React.FC<UserComponentProps> = ({ message }) => {
  const text = useRef(null)

  const PlannerPrompt = `Using each bullet point create a pontetial schedule for my day, balancing my time, acknoweldging when I wake up, and when I wind down, when I work, when I should eat. Look at my integrated calendars to see anything I have set in stone in my schedule. Determine how much time and how many repetitions for each bulleted task. Once you have all of the tasks parsed, place them optimally into my schedule. Then provide me a tentative schedule which I may choose to 'implement'.`

  /**
   * Store initial planner's reasoning, or concrete pieces (like calendar events, wake up/wind down times, etc)
   * Send initial planner's reasoning, a copy of the latest viewed/processed version of the text, and then the latest state of text
   * Only Call LLM on certain events, like upon clicking a button or perhaps pressing ctrl+enter
   *  When LLM is called, have a microanimation to acknowledge, and then the aiComponent will handle updating the user, this component's logcic is complete and can go back on 'standby'
   */
  const PlannerUpdatePrompt = `Go through all of the gathered data from the initial processing. Then see the new and/or updated tasks`

  // Create this hook that provides updates of the preset AI pieces I'm using/updating, like supabaseMessages, latest message / response, status, etc
  // This can serve to provide state/Intelligence links between multiple components
  const { setUserMessage, invokeAI } = useSharedAIContext()


  return (
    <div className="user-component">
      <div>
        <strong>User:</strong>
      </div>
      <Textarea
        placeholder="Type your message here..."
        defaultValue={message}
        className="mt-2"
        onChange={(e) => {
          if (text.current) (text.current as HTMLTextAreaElement).value = e.target.value;
        }}
      />
    </div>
  );
};

export default UserComponent;

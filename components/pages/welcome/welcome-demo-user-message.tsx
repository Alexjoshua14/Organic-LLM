"use client";

import type { UIMessage } from "ai";
import { motion, type Transition } from "framer-motion";

import { ChatMessage } from "@/components/chat/chat-message";
import { cn } from "@/lib/utils";

const ENTER_TRANSITION: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

/** Tightens production user bubbles inside welcome feature-card demos. */
const welcomeDemoUserMessageShellClass = cn(
  "text-[10px] leading-snug",
  "[&>div]:mb-1.5 [&>div]:max-w-[92%]",
  "[&_.rounded-lg]:px-2 [&_.rounded-lg]:py-1.5",
  "[&_p]:text-[10px] [&_p]:leading-snug [&_p]:my-0",
  "[&_li]:text-[10px] [&_li]:leading-snug"
);

/** Scales production chat UI down inside welcome feature-card demos. */
export const welcomeDemoCompactClass = cn(
  "text-[10px] leading-snug",
  "[&_.text-xs]:text-[10px]",
  "[&_.text-sm]:text-[10px]",
  "[&_summary]:text-[10px]",
  "[&_.prose]:text-[10px] [&_.prose_p]:my-0.5 [&_.prose_p]:text-[10px] [&_.prose_p]:leading-snug",
  "[&_.rounded-lg.p-4]:mb-2 [&_.rounded-lg.p-4]:px-2.5 [&_.rounded-lg.p-4]:py-2",
  "[&_.mb-4]:mb-2",
  "[&_button.h-8]:h-6 [&_button.h-8]:min-w-6 [&_button.h-8]:w-6",
  "[&_.size-4]:size-3",
  "[&_.h-7]:h-5 [&_.w-7]:w-5",
  "[&_.gap-2]:gap-1.5"
);

function demoUserMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

type WelcomeDemoUserMessageProps = {
  id: string;
  text: string;
  className?: string;
  animate?: boolean;
};

export function WelcomeDemoUserMessage({
  id,
  text,
  className,
  animate = true,
}: WelcomeDemoUserMessageProps) {
  const content = <ChatMessage message={demoUserMessage(id, text)} />;

  if (!animate) {
    return (
      <div className={cn("flex w-full justify-end", welcomeDemoUserMessageShellClass, className)}>
        {content}
      </div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full justify-end", welcomeDemoUserMessageShellClass, className)}
      initial={{ opacity: 0, y: 6 }}
      transition={ENTER_TRANSITION}
    >
      {content}
    </motion.div>
  );
}

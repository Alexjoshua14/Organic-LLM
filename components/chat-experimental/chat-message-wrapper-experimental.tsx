'use client'

import { FC } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ChatMessagerWrapperExperimentalProps = {
  role: "assistant" | "user" | "system";
  children: React.ReactNode;
  lastItem?: boolean;
  onAnimComplete: () => void;
};

export const ChatMessagerWrapperExperimental: FC<ChatMessagerWrapperExperimentalProps> = ({ children, role, onAnimComplete }) => {


  return (
    <AnimatePresence>
      <motion.div
        initial={{
          "display": "flex",
          "bottom": 0,
          "scale": .25,
          "translateY": "120%",
          "justifyContent": "center",
        }}
        animate={{
          "justifyContent": role === "assistant" ? "start" : "end",
          "scale": 1,
          "translateY": "0%",
        }}
        transition={{ duration: .75, ease: "easeInOut", }}
        onAnimationComplete={onAnimComplete}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function scramble(text: string): string {
  return text
    .split("")
    .map((c) => (c === " " ? " " : randomChar()))
    .join("");
}

interface DecryptedTextProps {
  text: string;
  speed?: number;
  className?: string;
}

export function DecryptedText({
  text,
  speed = 50,
  className = "",
}: DecryptedTextProps) {
  const [display, setDisplay] = useState(() => scramble(text));
  const [revealed, setRevealed] = useState(false);

  const stepRef = useRef(0);
  useEffect(() => {
    if (revealed) return;
    stepRef.current = 0;
    const interval = setInterval(() => {
      stepRef.current += 1;
      const step = stepRef.current;
      setDisplay(() => {
        const chars = text.split("");
        return chars
          .map((c, i) => {
            if (c === " ") return " ";
            return i < step ? c : randomChar();
          })
          .join("");
      });
      if (step >= text.length) {
        setRevealed(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, revealed]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      {display}
    </motion.span>
  );
}

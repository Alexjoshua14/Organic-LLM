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

type LoopPhase = "rest" | "encrypting" | "hold" | "decrypting";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  className?: string;
  /** When true, loop: rest 5s → encrypt → hold 2s → decrypt → repeat. Only runs while in view. */
  loop?: boolean;
}

export function DecryptedText({
  text,
  speed = 50,
  className = "",
  loop = false,
}: DecryptedTextProps) {
  const [display, setDisplay] = useState(() => (loop ? text : scramble(text)));
  const [revealed, setRevealed] = useState(!loop);
  const [loopPhase, setLoopPhase] = useState<LoopPhase>("rest");
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const stepRef = useRef(0);
  const encryptedRef = useRef<string[]>([]);

  // In-view detection when looping
  useEffect(() => {
    if (!loop || !containerRef.current) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        setInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px" }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [loop]);

  // One-shot decrypt (initial or non-loop)
  useEffect(() => {
    if (loop || revealed) return;
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
  }, [text, speed, revealed, loop]);

  // Loop: rest 5s then go to encrypting
  useEffect(() => {
    if (!loop || !inView || loopPhase !== "rest") return;
    setDisplay(text);
    const t = setTimeout(() => setLoopPhase("encrypting"), 5000);

    return () => clearTimeout(t);
  }, [loop, inView, loopPhase, text]);

  // Loop: encrypting – replace chars with random one by one (keep previous randoms stable)
  useEffect(() => {
    if (!loop || !inView || loopPhase !== "encrypting") return;
    stepRef.current = 0;
    encryptedRef.current = [];
    const interval = setInterval(() => {
      stepRef.current += 1;
      const step = stepRef.current;
      const chars = text.split("");

      if (step <= chars.length) {
        if (chars[step - 1] !== " ") encryptedRef.current[step - 1] = randomChar();
        else encryptedRef.current[step - 1] = " ";
      }
      setDisplay(() => {
        const out = chars.map((c, i) => {
          if (c === " ") return " ";

          return i < step ? (encryptedRef.current[i] ?? randomChar()) : c;
        });

        return out.join("");
      });
      if (step >= text.length) {
        setLoopPhase("hold");
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [loop, inView, loopPhase, text, speed]);

  // Loop: hold scrambled 2s then decrypting
  useEffect(() => {
    if (!loop || !inView || loopPhase !== "hold") return;
    const t = setTimeout(() => setLoopPhase("decrypting"), 2000);

    return () => clearTimeout(t);
  }, [loop, inView, loopPhase]);

  // Loop: decrypting – reveal from scrambled to text
  useEffect(() => {
    if (!loop || !inView || loopPhase !== "decrypting") return;
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
        setLoopPhase("rest");
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [loop, inView, loopPhase, text, speed]);

  // Reset to rest when leaving view (so we don't start mid-phase when scrolling back)
  useEffect(() => {
    if (!loop) return;
    if (!inView) {
      setLoopPhase("rest");
      setDisplay(text);
    }
  }, [loop, inView, text]);

  return (
    <motion.span
      ref={containerRef}
      animate={{ opacity: 1 }}
      className={className}
      initial={{ opacity: 1 }}
    >
      {display}
    </motion.span>
  );
}

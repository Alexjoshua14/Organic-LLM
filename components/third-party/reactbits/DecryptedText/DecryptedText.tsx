"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";

export interface DecryptedTextProps extends HTMLMotionProps<"span"> {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
  animateOn?: "view" | "hover" | "inViewHover" | "click" | "loop" | "controlled";
  clickMode?: "once" | "toggle";
  /** Pause on plaintext before encrypting (loop mode). */
  loopRestMs?: number;
  /** Pause on ciphertext before decrypting (loop mode). */
  loopHoldEncryptedMs?: number;
  /** Parent-driven phase when `animateOn="controlled"`. */
  controlPhase?: DecryptedTextControlPhase;
  onControlPhaseComplete?: (phase: "encrypted" | "plain", displayText: string) => void;
}

export type DecryptedTextControlPhase =
  | "plain"
  | "encrypting"
  | "encrypted"
  | "decrypting";

type Direction = "forward" | "reverse";

export function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className = "",
  parentClassName = "",
  encryptedClassName = "",
  animateOn = "hover",
  clickMode = "once",
  loopRestMs = 2800,
  loopHoldEncryptedMs = 2200,
  controlPhase = "plain",
  onControlPhaseComplete,
  ...props
}: DecryptedTextProps) {
  const reduceMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(animateOn !== "click");
  const [direction, setDirection] = useState<Direction>("forward");
  const [loopEnabled, setLoopEnabled] = useState(false);

  const containerRef = useRef<HTMLSpanElement>(null);
  const orderRef = useRef<number[]>([]);
  const pointerRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasAnimatingRef = useRef(false);
  const controlPhaseRef = useRef(controlPhase);
  const displayTextRef = useRef(displayText);
  const prevControlPhaseRef = useRef<DecryptedTextControlPhase | null>(null);
  const prevControlledTextRef = useRef(text);
  controlPhaseRef.current = controlPhase;
  displayTextRef.current = displayText;

  const availableChars = useMemo<string[]>(() => {
    return useOriginalCharsOnly
      ? Array.from(new Set(text.split(""))).filter((char) => char !== " ")
      : characters.split("");
  }, [useOriginalCharsOnly, text, characters]);

  const shuffleText = useCallback(
    (originalText: string, currentRevealed: Set<number>) => {
      return originalText
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (currentRevealed.has(i)) return originalText[i];
          return availableChars[Math.floor(Math.random() * availableChars.length)];
        })
        .join("");
    },
    [availableChars]
  );

  const computeOrder = useCallback(
    (len: number): number[] => {
      const order: number[] = [];
      if (len <= 0) return order;
      if (revealDirection === "start") {
        for (let i = 0; i < len; i++) order.push(i);
        return order;
      }
      if (revealDirection === "end") {
        for (let i = len - 1; i >= 0; i--) order.push(i);
        return order;
      }
      const middle = Math.floor(len / 2);
      let offset = 0;
      while (order.length < len) {
        if (offset % 2 === 0) {
          const idx = middle + offset / 2;
          if (idx >= 0 && idx < len) order.push(idx);
        } else {
          const idx = middle - Math.ceil(offset / 2);
          if (idx >= 0 && idx < len) order.push(idx);
        }
        offset++;
      }
      return order.slice(0, len);
    },
    [revealDirection]
  );

  const fillAllIndices = useCallback((): Set<number> => {
    const indices = new Set<number>();
    for (let i = 0; i < text.length; i++) indices.add(i);
    return indices;
  }, [text]);

  const removeRandomIndices = useCallback((set: Set<number>, count: number): Set<number> => {
    const arr = Array.from(set);
    for (let i = 0; i < count && arr.length > 0; i++) {
      const idx = Math.floor(Math.random() * arr.length);
      arr.splice(idx, 1);
    }
    return new Set(arr);
  }, []);

  const clearLoopTimer = useCallback(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  const encryptInstantly = useCallback(() => {
    const emptySet = new Set<number>();
    setRevealedIndices(emptySet);
    setDisplayText(shuffleText(text, emptySet));
    setIsDecrypted(false);
  }, [text, shuffleText]);

  const triggerDecrypt = useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length);
      pointerRef.current = 0;
      setRevealedIndices(new Set());
    } else {
      setRevealedIndices(new Set());
    }
    setDirection("forward");
    setIsAnimating(true);
  }, [sequential, computeOrder, text.length]);

  const triggerReverse = useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length).slice().reverse();
      pointerRef.current = 0;
      setRevealedIndices(fillAllIndices());
      setDisplayText(shuffleText(text, fillAllIndices()));
    } else {
      setRevealedIndices(fillAllIndices());
      setDisplayText(shuffleText(text, fillAllIndices()));
    }
    setDirection("reverse");
    setIsAnimating(true);
  }, [sequential, computeOrder, fillAllIndices, shuffleText, text]);

  useEffect(() => {
    if (!isAnimating) return;

    let currentIteration = 0;

    const getNextIndex = (revealedSet: Set<number>): number => {
      const textLength = text.length;
      switch (revealDirection) {
        case "start":
          return revealedSet.size;
        case "end":
          return textLength - 1 - revealedSet.size;
        case "center": {
          const middle = Math.floor(textLength / 2);
          const offset = Math.floor(revealedSet.size / 2);
          const nextIndex = revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1;

          if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) {
            return nextIndex;
          }
          for (let i = 0; i < textLength; i++) {
            if (!revealedSet.has(i)) return i;
          }
          return 0;
        }
        default:
          return revealedSet.size;
      }
    };

    intervalRef.current = setInterval(() => {
      setRevealedIndices((prevRevealed) => {
        if (sequential) {
          if (direction === "forward") {
            if (prevRevealed.size < text.length) {
              const nextIndex = getNextIndex(prevRevealed);
              const newRevealed = new Set(prevRevealed);
              newRevealed.add(nextIndex);
              setDisplayText(shuffleText(text, newRevealed));
              return newRevealed;
            }
            clearInterval(intervalRef.current ?? undefined);
            setIsAnimating(false);
            setIsDecrypted(true);
            return prevRevealed;
          }

          if (direction === "reverse") {
            if (pointerRef.current < orderRef.current.length) {
              const idxToRemove = orderRef.current[pointerRef.current++];
              const newRevealed = new Set(prevRevealed);
              newRevealed.delete(idxToRemove);
              setDisplayText(shuffleText(text, newRevealed));
              if (newRevealed.size === 0) {
                clearInterval(intervalRef.current ?? undefined);
                setIsAnimating(false);
                setIsDecrypted(false);
              }
              return newRevealed;
            }
            clearInterval(intervalRef.current ?? undefined);
            setIsAnimating(false);
            setIsDecrypted(false);
            return prevRevealed;
          }
        } else if (direction === "forward") {
          setDisplayText(shuffleText(text, prevRevealed));
          currentIteration++;
          if (currentIteration >= maxIterations) {
            clearInterval(intervalRef.current ?? undefined);
            setIsAnimating(false);
            setDisplayText(text);
            setIsDecrypted(true);
          }
          return prevRevealed;
        } else {
          let currentSet = prevRevealed;
          if (currentSet.size === 0) currentSet = fillAllIndices();
          const removeCount = Math.max(1, Math.ceil(text.length / Math.max(1, maxIterations)));
          const nextSet = removeRandomIndices(currentSet, removeCount);
          setDisplayText(shuffleText(text, nextSet));
          currentIteration++;
          if (nextSet.size === 0 || currentIteration >= maxIterations) {
            clearInterval(intervalRef.current ?? undefined);
            setIsAnimating(false);
            setIsDecrypted(false);
            setDisplayText(shuffleText(text, new Set()));
            return new Set();
          }
          return nextSet;
        }
        return prevRevealed;
      });
    }, speed);

    return () => clearInterval(intervalRef.current ?? undefined);
  }, [
    direction,
    fillAllIndices,
    isAnimating,
    maxIterations,
    removeRandomIndices,
    revealDirection,
    sequential,
    shuffleText,
    speed,
    text,
  ]);

  const handleClick = () => {
    if (animateOn !== "click") return;

    if (clickMode === "once") {
      if (isDecrypted) return;
      setDirection("forward");
      triggerDecrypt();
    }

    if (clickMode === "toggle") {
      if (isDecrypted) triggerReverse();
      else {
        setDirection("forward");
        triggerDecrypt();
      }
    }
  };

  const triggerHoverDecrypt = useCallback(() => {
    if (isAnimating) return;
    setRevealedIndices(new Set());
    setIsDecrypted(false);
    setDisplayText(text);
    setDirection("forward");
    setIsAnimating(true);
  }, [isAnimating, text]);

  const resetToPlainText = useCallback(() => {
    clearInterval(intervalRef.current ?? undefined);
    setIsAnimating(false);
    setRevealedIndices(new Set());
    setDisplayText(text);
    setIsDecrypted(true);
    setDirection("forward");
  }, [text]);

  useEffect(() => {
    if (animateOn !== "view" && animateOn !== "inViewHover") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            triggerDecrypt();
            setHasAnimated(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    const currentRef = containerRef.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [animateOn, hasAnimated, triggerDecrypt]);

  useEffect(() => {
    if (animateOn !== "loop") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setLoopEnabled(entry.isIntersecting));
      },
      { threshold: 0.2 }
    );

    const currentRef = containerRef.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
      clearLoopTimer();
    };
  }, [animateOn, clearLoopTimer]);

  useEffect(() => {
    if (animateOn !== "loop" || !loopEnabled || reduceMotion) {
      clearLoopTimer();
      return;
    }

    setDisplayText(text);
    setIsDecrypted(true);
    setIsAnimating(false);
    setRevealedIndices(new Set());
    setDirection("forward");
  }, [animateOn, clearLoopTimer, loopEnabled, reduceMotion, text]);

  useEffect(() => {
    if (animateOn !== "loop" || !loopEnabled || reduceMotion || isAnimating) return;

    clearLoopTimer();
    loopTimerRef.current = setTimeout(
      () => {
        if (isDecrypted) triggerReverse();
        else triggerDecrypt();
      },
      isDecrypted ? loopRestMs : loopHoldEncryptedMs
    );

    return clearLoopTimer;
  }, [
    animateOn,
    clearLoopTimer,
    isAnimating,
    isDecrypted,
    loopEnabled,
    loopHoldEncryptedMs,
    loopRestMs,
    reduceMotion,
    triggerDecrypt,
    triggerReverse,
  ]);

  useEffect(() => {
    if (animateOn === "click") encryptInstantly();
    else if (animateOn !== "loop" && animateOn !== "controlled") {
      setDisplayText(text);
      setIsDecrypted(true);
    }
    if (animateOn !== "controlled") {
      setRevealedIndices(new Set());
      setDirection("forward");
    }
  }, [animateOn, encryptInstantly, text]);

  useEffect(() => {
    if (animateOn !== "controlled") return;

    const phaseChanged = prevControlPhaseRef.current !== controlPhase;
    const textChanged = prevControlledTextRef.current !== text;
    prevControlPhaseRef.current = controlPhase;
    prevControlledTextRef.current = text;

    if (controlPhase === "plain") {
      if (phaseChanged || textChanged) {
        clearInterval(intervalRef.current ?? undefined);
        setIsAnimating(false);
        setRevealedIndices(new Set());
        setDisplayText(text);
        setIsDecrypted(true);
        setDirection("forward");
      }
      return;
    }

    if (!phaseChanged) return;

    clearInterval(intervalRef.current ?? undefined);
    setIsAnimating(false);

    switch (controlPhase) {
      case "encrypted":
        encryptInstantly();
        break;
      case "encrypting":
        triggerReverse();
        break;
      case "decrypting":
        triggerDecrypt();
        break;
    }
  }, [
    animateOn,
    controlPhase,
    encryptInstantly,
    text,
    triggerDecrypt,
    triggerReverse,
  ]);

  useEffect(() => {
    if (animateOn !== "controlled" || !onControlPhaseComplete) return;

    if (wasAnimatingRef.current && !isAnimating) {
      if (!isDecrypted && controlPhaseRef.current === "encrypting") {
        onControlPhaseComplete("encrypted", displayTextRef.current);
      } else if (isDecrypted && controlPhaseRef.current === "decrypting") {
        onControlPhaseComplete("plain", displayTextRef.current);
      }
    }

    wasAnimatingRef.current = isAnimating;
  }, [animateOn, isAnimating, isDecrypted, onControlPhaseComplete]);

  const animateProps: HTMLMotionProps<"span"> =
    animateOn === "hover" || animateOn === "inViewHover"
      ? {
          onMouseEnter: triggerHoverDecrypt,
          onMouseLeave: resetToPlainText,
        }
      : animateOn === "click"
        ? { onClick: handleClick }
        : {};

  if (reduceMotion) {
    return (
      <span className={cn("inline-block whitespace-pre-wrap", parentClassName, className)}>
        {text}
      </span>
    );
  }

  return (
    <motion.span
      ref={containerRef}
      className={cn("inline-block whitespace-pre-wrap", parentClassName)}
      {...animateProps}
      {...props}
    >
      <span className="sr-only">{displayText}</span>
      <span aria-hidden="true">
        {displayText.split("").map((char, index) => {
          const isRevealedOrDone =
            revealedIndices.has(index) || (!isAnimating && isDecrypted);

          return (
            <span key={index} className={isRevealedOrDone ? className : encryptedClassName}>
              {char}
            </span>
          );
        })}
      </span>
    </motion.span>
  );
}

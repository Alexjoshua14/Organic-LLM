"use client";

import { AnimatePresence, motion } from "framer-motion";
import { memo, useState } from "react";

import { LIVING_COUNT_TICK_S } from "./living-board-timing";

import { cn } from "@/lib/utils";

const tickVariants = {
  enter: (direction: number) => ({ y: direction * 7, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: number) => ({ y: direction * -7, opacity: 0 }),
};

/** A count that rolls up or down when it changes. */
export const CountTick = memo(function CountTick({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState(1);

  if (value !== previous) {
    setDirection(value > previous ? 1 : -1);
    setPrevious(value);
  }

  return (
    <span className={cn("relative inline-flex overflow-hidden tabular-nums", className)}>
      <AnimatePresence custom={direction} initial={false} mode="popLayout">
        <motion.span
          key={value}
          animate="center"
          custom={direction}
          exit="exit"
          initial="enter"
          transition={{ duration: LIVING_COUNT_TICK_S, ease: "easeOut" }}
          variants={tickVariants}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
});

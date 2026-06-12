import type { Transition, Variants } from "framer-motion";

import { useReducedMotion } from "framer-motion";

export const WELCOME_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const HOVER_SPRING: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28,
};

export function useWelcomeMotion() {
  const reduce = useReducedMotion();

  const staggerContainer: Variants = reduce
    ? { hidden: {}, show: {} }
    : {
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.08,
            delayChildren: 0.06,
          },
        },
      };

  const staggerItem: Variants = reduce
    ? { hidden: { opacity: 1, y: 0, scaleX: 1, filter: "blur(0px)" }, show: { opacity: 1, y: 0, scaleX: 1, filter: "blur(0px)" } }
    : {
        hidden: { opacity: 0, y: 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: WELCOME_EASE },
        },
      };

  const hairline: Variants = reduce
    ? { hidden: { scaleX: 1 }, show: { scaleX: 1 } }
    : {
        hidden: { scaleX: 0 },
        show: {
          scaleX: 1,
          transition: { duration: 0.5, ease: WELCOME_EASE },
        },
      };

  const maskReveal: Variants = reduce
    ? { hidden: { y: 0 }, show: { y: 0 } }
    : {
        hidden: { y: "100%" },
        show: {
          y: 0,
          transition: { duration: 0.5, ease: WELCOME_EASE },
        },
      };

  const blurReveal: Variants = reduce
    ? { hidden: { opacity: 1, filter: "blur(0px)" }, show: { opacity: 1, filter: "blur(0px)" } }
    : {
        hidden: { opacity: 0, filter: "blur(6px)" },
        show: {
          opacity: 1,
          filter: "blur(0px)",
          transition: { duration: 0.55, ease: WELCOME_EASE },
        },
      };

  const hoverScale = reduce
    ? {}
    : {
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
        transition: HOVER_SPRING,
      };

  const chipHover = reduce
    ? {}
    : {
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.98 },
        transition: HOVER_SPRING,
      };

  return {
    reduce,
    staggerContainer,
    staggerItem,
    hairline,
    maskReveal,
    blurReveal,
    hoverScale,
    chipHover,
  };
}

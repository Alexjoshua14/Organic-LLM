import type { Variants } from "framer-motion";

import { useReducedMotion } from "framer-motion";

export function useLandingMotion() {
  const reduce = useReducedMotion();

  const sectionReveal = reduce
    ? undefined
    : ({
        initial: { opacity: 0, y: 14 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2, margin: "0px 0px -8% 0px" },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      } as const);

  const staggerContainer: Variants = reduce
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.06, delayChildren: 0.04 },
        },
      };

  const staggerItem: Variants = reduce
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        },
      };

  const fadeIn = reduce
    ? undefined
    : {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: { once: true, amount: 0.25 },
        transition: { duration: 0.4 },
      };

  return { reduce, sectionReveal, staggerContainer, staggerItem, fadeIn };
}

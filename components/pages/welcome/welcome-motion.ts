import type { Transition, Variants } from "framer-motion";

import { useReducedMotion } from "framer-motion";

export const WELCOME_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Horizontal travel for paired cards entering from opposite sides. */
const SIDE_ENTRANCE_PX = 32;

/** Below-fold groups reveal once, after a good share has scrolled clear of the lower edge. */
export const WELCOME_IN_VIEW = { once: true, amount: 0.4, margin: "0px 0px -15% 0px" } as const;

/** Gap between siblings in a reveal; also offsets self-triggered items that share a row. */
const WELCOME_STAGGER_S = 0.18;

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
            staggerChildren: WELCOME_STAGGER_S,
            delayChildren: 0.12,
          },
        },
      };

  const staggerItem: Variants = reduce
    ? {
        hidden: { opacity: 1, y: 0, scaleX: 1, filter: "blur(0px)" },
        show: { opacity: 1, y: 0, scaleX: 1, filter: "blur(0px)" },
      }
    : {
        hidden: { opacity: 0, y: 14 },
        // `custom` is the item's index when it triggers itself rather than through a group.
        show: (index = 0) => ({
          opacity: 1,
          y: 0,
          transition: { duration: 0.9, ease: WELCOME_EASE, delay: index * WELCOME_STAGGER_S },
        }),
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

  // Scales up from depth while rising, so the heading reads as arriving from behind the page.
  const riseFromBehind: Variants = reduce
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 18, scale: 0.92 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 1.25, ease: WELCOME_EASE },
        },
      };

  const slideIn = (fromX: number): Variants =>
    reduce
      ? { hidden: {}, show: {} }
      : {
          hidden: { opacity: 0, x: fromX },
          show: { opacity: 1, x: 0, transition: { duration: 1.1, ease: WELCOME_EASE } },
        };
  const fromLeft = slideIn(-SIDE_ENTRANCE_PX);
  const fromRight = slideIn(SIDE_ENTRANCE_PX);

  // Spread on a group so it triggers in view and staggers its `staggerItem` children.
  const inViewGroup = reduce
    ? {}
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: WELCOME_IN_VIEW,
        variants: staggerContainer,
      };

  // For items too tall to share one trigger on small screens; pass `custom={index}` for stagger.
  const inViewItem = reduce
    ? {}
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: WELCOME_IN_VIEW,
        variants: staggerItem,
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
    inViewGroup,
    inViewItem,
    riseFromBehind,
    fromLeft,
    fromRight,
    hairline,
    maskReveal,
    blurReveal,
    hoverScale,
    chipHover,
  };
}

/** Motion tokens for the Ergon document viewer expand/collapse. */
export const ERGON_DOC_VIEWER_MOTION = {
  enter: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  exit: { duration: 0.14, ease: [0.4, 0, 1, 1] as const },
  spring: { type: "spring" as const, stiffness: 420, damping: 34 },
};

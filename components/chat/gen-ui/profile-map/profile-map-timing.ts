/** Expand/collapse spring for a profile-map node detail panel. */
export const PROFILE_MAP_PANEL_SPRING = {
  type: "spring" as const,
  stiffness: 260,
  damping: 30,
};

/** Instant land when prefers-reduced-motion is on. */
export const PROFILE_MAP_PANEL_REDUCED = { duration: 0 } as const;

/** Delay before scrolling a jumped-to node into view (ms). */
export const PROFILE_MAP_JUMP_SCROLL_MS = 50;

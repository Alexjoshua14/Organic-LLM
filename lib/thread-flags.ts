/**
 * Centralized thread flags: a single uint32 per thread where each bit is a boolean.
 * Use this module for all read/write/update/clear of thread flags so bits stay consistent.
 */

/** Bit positions / mask values for thread flags (uint32). */
export const THREAD_FLAGS = {
  /** Thread has an LLM-generated or user-set title (avoids re-running ensureChatHasTitle). */
  HAS_TITLE: 1 << 0,
  // Reserve more bits for future use, e.g.:
  // PINNED: 1 << 1,
  // ARCHIVED: 1 << 2,
} as const;

export type ThreadFlagsMask = (typeof THREAD_FLAGS)[keyof typeof THREAD_FLAGS];

/** Decoded booleans from a flags number (raw from DB may be null). */
export type ThreadFlagsDecoded = {
  hasTitle: boolean;
};

const DEFAULT_FLAGS = 0;

/**
 * Decode a raw flags value (may be null for old rows) into booleans.
 */
export function decodeThreadFlags(flags: number | null | undefined): ThreadFlagsDecoded {
  const f = flags ?? DEFAULT_FLAGS;

  return {
    hasTitle: (f & THREAD_FLAGS.HAS_TITLE) !== 0,
  };
}

/**
 * Set a single flag bit; returns new flags value.
 */
export function setFlag(flags: number | null | undefined, flag: number): number {
  const f = flags ?? DEFAULT_FLAGS;

  return f | flag;
}

/**
 * Clear a single flag bit; returns new flags value.
 */
export function clearFlag(flags: number | null | undefined, flag: number): number {
  const f = flags ?? DEFAULT_FLAGS;

  return f & ~flag;
}

/**
 * Check if a flag bit is set.
 */
export function hasFlag(flags: number | null | undefined, flag: number): boolean {
  const f = flags ?? DEFAULT_FLAGS;

  return (f & flag) !== 0;
}

/**
 * Update multiple decoded booleans into a new flags value.
 * Only the keys present in `updates` are applied; others keep current value.
 */
export function updateFlags(
  currentFlags: number | null | undefined,
  updates: Partial<ThreadFlagsDecoded>
): number {
  let f = currentFlags ?? DEFAULT_FLAGS;

  if (updates.hasTitle !== undefined) {
    f = updates.hasTitle
      ? setFlag(f, THREAD_FLAGS.HAS_TITLE)
      : clearFlag(f, THREAD_FLAGS.HAS_TITLE);
  }

  return f;
}

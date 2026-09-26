/**
 * Multitask dashboard panel shares, shortcuts, and scroll-anchor math.
 * Spacing / focus constants live next to layout — do not scatter magic numbers.
 */

/** Small focus bias when both panels are open (fraction of the row). Not a takeover. */
export const MULTITASK_FOCUS_SHARE_SHIFT = 0.04;

/**
 * Base shares when both panels are visible and focus is neutral / orchestrator-default.
 * Chat stays the main column; board is supporting.
 */
export const MULTITASK_BASE_CHAT_SHARE = 0.66;
export const MULTITASK_BASE_BOARD_SHARE = 0.34;

export type MultitaskPanelFocus = "orchestrator" | "subagent";

export type MultitaskPanelVisibility = {
  chatOpen: boolean;
  boardOpen: boolean;
};

export type MultitaskPanelShares = {
  chat: number;
  board: number;
};

/**
 * Resolve flex/grid shares for the two desktop panels.
 * Collapsed panels get 0; the visible one takes the freed space.
 */
export function resolveMultitaskPanelShares(args: {
  chatOpen: boolean;
  boardOpen: boolean;
  focus: MultitaskPanelFocus;
}): MultitaskPanelShares {
  const { chatOpen, boardOpen, focus } = args;

  if (chatOpen && !boardOpen) return { chat: 1, board: 0 };
  if (!chatOpen && boardOpen) return { chat: 0, board: 1 };
  if (!chatOpen && !boardOpen) return { chat: 0, board: 0 };

  const shift = MULTITASK_FOCUS_SHARE_SHIFT;

  if (focus === "orchestrator") {
    return {
      chat: MULTITASK_BASE_CHAT_SHARE + shift,
      board: MULTITASK_BASE_BOARD_SHARE - shift,
    };
  }

  return {
    chat: MULTITASK_BASE_CHAT_SHARE - shift,
    board: MULTITASK_BASE_BOARD_SHARE + shift,
  };
}

/** Toggle helpers — pure so Ctrl+Q / Ctrl+W can be unit-tested without DOM. */
export function toggleChatPanel(visibility: MultitaskPanelVisibility): MultitaskPanelVisibility {
  return { ...visibility, chatOpen: !visibility.chatOpen };
}

export function toggleBoardPanel(visibility: MultitaskPanelVisibility): MultitaskPanelVisibility {
  return { ...visibility, boardOpen: !visibility.boardOpen };
}

/**
 * Map a keyboard event to a multitask panel action.
 * Only Ctrl (not Meta) — matches the product shortcut and avoids Cmd+W closing a tab on macOS.
 */
export function multitaskShortcutAction(event: {
  key: string;
  ctrlKey: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): "toggle-chat" | "toggle-board" | null {
  if (!event.ctrlKey || event.altKey) return null;

  const key = event.key.toLowerCase();

  if (key === "q") return "toggle-chat";
  if (key === "w") return "toggle-board";

  return null;
}

// ---------------------------------------------------------------------------
// Scroll eye-line pin (pure geometry — DOM adapter calls these)
// ---------------------------------------------------------------------------

export type ScrollAnchorRect = {
  /** Stable id for the pinned node (message / block). */
  id: string;
  top: number;
  bottom: number;
};

/**
 * Pick the candidate whose vertical center is nearest the scrollport midpoint.
 */
export function pickMidpointScrollAnchor(
  candidates: ReadonlyArray<ScrollAnchorRect>,
  viewportTop: number,
  viewportHeight: number
): ScrollAnchorRect | null {
  if (candidates.length === 0 || viewportHeight <= 0) return null;

  const mid = viewportTop + viewportHeight / 2;
  let best: ScrollAnchorRect | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const node of candidates) {
    const center = (node.top + node.bottom) / 2;
    const dist = Math.abs(center - mid);

    if (dist < bestDist) {
      bestDist = dist;
      best = node;
    }
  }

  return best;
}

/** Node top relative to the scrollport's visible top edge. */
export function nodeViewportY(nodeTop: number, viewportTop: number): number {
  return nodeTop - viewportTop;
}

/**
 * How much to add to `scrollTop` so the pinned node's top returns to the same
 * viewport Y after a layout/width change moved it.
 */
export function scrollTopDeltaToPreserveViewportY(
  nodeTopBefore: number,
  nodeTopAfter: number
): number {
  return nodeTopAfter - nodeTopBefore;
}

/**
 * Viewport Y of the pinned node after applying a scrollTop delta
 * (positive delta moves content up → node top decreases).
 */
export function viewportYAfterScrollAdjust(args: {
  nodeTopAfter: number;
  viewportTop: number;
  scrollDelta: number;
}): number {
  return nodeViewportY(args.nodeTopAfter - args.scrollDelta, args.viewportTop);
}

/**
 * Multitask dashboard panel shares, shortcuts, and scroll-anchor math.
 * Spacing / width constants live next to layout — do not scatter magic numbers.
 */

/**
 * Fixed shares when both panels are visible. Keep the original orchestrator-default split;
 * focusing or selecting an agent must not squeeze the thread.
 */
export const MULTITASK_BASE_CHAT_SHARE = 0.7;
export const MULTITASK_BASE_BOARD_SHARE = 0.3;

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
}): MultitaskPanelShares {
  const { chatOpen, boardOpen } = args;

  if (chatOpen && !boardOpen) return { chat: 1, board: 0 };
  if (!chatOpen && boardOpen) return { chat: 0, board: 1 };
  if (!chatOpen && !boardOpen) return { chat: 0, board: 0 };

  return {
    chat: MULTITASK_BASE_CHAT_SHARE,
    board: MULTITASK_BASE_BOARD_SHARE,
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

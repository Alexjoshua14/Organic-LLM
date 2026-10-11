import { describe, expect, test } from "bun:test";

import {
  MULTITASK_BASE_BOARD_SHARE,
  MULTITASK_BASE_CHAT_SHARE,
  multitaskShortcutAction,
  nodeViewportY,
  pickMidpointScrollAnchor,
  resolveMultitaskPanelShares,
  scrollTopDeltaToPreserveViewportY,
  toggleBoardPanel,
  toggleChatPanel,
  viewportYAfterScrollAdjust,
} from "@/lib/arcadia/multitask/panel-layout";

describe("multitaskShortcutAction", () => {
  test("Ctrl+Q toggles the orchestrator chat panel", () => {
    expect(multitaskShortcutAction({ key: "q", ctrlKey: true })).toBe("toggle-chat");
    expect(multitaskShortcutAction({ key: "Q", ctrlKey: true })).toBe("toggle-chat");
  });

  test("Ctrl+W toggles the subagent board panel", () => {
    expect(multitaskShortcutAction({ key: "w", ctrlKey: true })).toBe("toggle-board");
    expect(multitaskShortcutAction({ key: "W", ctrlKey: true })).toBe("toggle-board");
  });

  test("ignores unmodified and non-ctrl chords", () => {
    expect(multitaskShortcutAction({ key: "q", ctrlKey: false })).toBeNull();
    expect(multitaskShortcutAction({ key: "w", ctrlKey: false, metaKey: true })).toBeNull();
    expect(multitaskShortcutAction({ key: "q", ctrlKey: true, altKey: true })).toBeNull();
  });

  test("toggle helpers flip the correct panel only", () => {
    const both = { chatOpen: true, boardOpen: true };

    expect(toggleChatPanel(both)).toEqual({ chatOpen: false, boardOpen: true });
    expect(toggleBoardPanel(both)).toEqual({ chatOpen: true, boardOpen: false });
  });
});

describe("resolveMultitaskPanelShares", () => {
  test("both visible panels keep the fixed chat and board split", () => {
    const shares = resolveMultitaskPanelShares({
      chatOpen: true,
      boardOpen: true,
    });

    expect(shares.chat).toBe(MULTITASK_BASE_CHAT_SHARE);
    expect(shares.board).toBe(MULTITASK_BASE_BOARD_SHARE);
    expect(shares.chat + shares.board).toBeCloseTo(1);
  });

  test("collapsed panel frees its share for the visible one", () => {
    expect(
      resolveMultitaskPanelShares({
        chatOpen: true,
        boardOpen: false,
      })
    ).toEqual({ chat: 1, board: 0 });
    expect(
      resolveMultitaskPanelShares({
        chatOpen: false,
        boardOpen: true,
      })
    ).toEqual({ chat: 0, board: 1 });
  });
});

describe("scroll eye-line pin", () => {
  test("pickMidpointScrollAnchor chooses the node nearest the viewport mid", () => {
    const picked = pickMidpointScrollAnchor(
      [
        { id: "a", top: 100, bottom: 140 },
        { id: "b", top: 200, bottom: 260 },
        { id: "c", top: 400, bottom: 480 },
      ],
      100,
      300
    );

    // Midpoint at 100 + 150 = 250 → node b (center 230) wins over a (120) and c (440).
    expect(picked?.id).toBe("b");
  });

  test("scroll-anchor helper keeps the same viewport Y after a width change", () => {
    const viewportTop = 80;
    const nodeTopBefore = 200;
    const preservedY = nodeViewportY(nodeTopBefore, viewportTop);

    // Width change reflows the node 24px lower in the viewport.
    const nodeTopAfter = nodeTopBefore + 24;
    const delta = scrollTopDeltaToPreserveViewportY(nodeTopBefore, nodeTopAfter);
    const yAfter = viewportYAfterScrollAdjust({
      nodeTopAfter,
      viewportTop,
      scrollDelta: delta,
    });

    expect(delta).toBe(24);
    expect(yAfter).toBe(preservedY);
  });
});

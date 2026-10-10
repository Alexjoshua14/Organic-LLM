import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

/**
 * Overlay = normal chat (+ optional floating Multitask drawer when toggled off).
 * Dashboard = user-toggled multiagent board with confined chat.
 */
export type ArcadiaMultitaskLayoutMode = "overlay" | "dashboard";

/** Where the Arcadia composer is explicitly addressing outbound text. */
export type ArcadiaMultitaskSendTarget =
  | { kind: "orchestrator" }
  | { kind: "subagent"; agentId: string };

export const DEFAULT_MULTITASK_SEND_TARGET: ArcadiaMultitaskSendTarget = {
  kind: "orchestrator",
};

/** Statuses that count as "running" for board badges — not for forcing the dashboard. */
export const ARCADIA_RUNNING_STATUSES = new Set<ArcadiaSubagent["status"]>(["working", "blocked"]);

/**
 * Dashboard / board split (CSS `lg`). Keep next to layout — do not scatter magic widths.
 * Below this, the multitask dashboard is a single-column scroll + docked composer stack.
 *
 * Desktop intent (see screenshot cleanup): orchestrator chat is the main interaction and must
 * win width; the agent list is a supporting column. Gutters and top pad sit next to the grid.
 */
export const MULTITASK_DASHBOARD_WIDE_MIN_PX = 1024;

/** Outer pad — title must clear the viewport edge (not flush). */
export const MULTITASK_DESKTOP_PAD_TOP_PX = 20;
export const MULTITASK_DESKTOP_PAD_X_PX = 16;
export const MULTITASK_DESKTOP_PAD_BOTTOM_PX = 12;

/** Gap between chat surface and agent board (calm seam — no hard rule). */
export const MULTITASK_DESKTOP_GUTTER_PX = 20;

/**
 * Agent board column on wide desktop. Cap keeps chat (`1fr`) wider than the board at typical
 * laptop widths (≥ {@link MULTITASK_DASHBOARD_WIDE_MIN_PX}).
 */
export const MULTITASK_DESKTOP_AGENT_COL_MIN_PX = 260;
export const MULTITASK_DESKTOP_AGENT_COL_MAX_PX = 300;

/** Cross-device poll while an Arcadia thread page is open (ms). */
export const MULTITASK_VIEW_POLL_MS = 2_500;
/** Ordinary chat checks for cross-device changes without polling the worker APIs. */
export const MULTITASK_VIEW_POLL_IDLE_MS = 30_000;

/**
 * True when, at a given viewport width, the confined chat column is wider than the agent column.
 * Used by layout tests — mirrors the CSS `1fr` + capped agent track.
 */
export function desktopChatWiderThanAgentColumn(viewportWidthPx: number): boolean {
  const usable = viewportWidthPx - MULTITASK_DESKTOP_PAD_X_PX * 2 - MULTITASK_DESKTOP_GUTTER_PX;
  const agentCol = Math.min(
    MULTITASK_DESKTOP_AGENT_COL_MAX_PX,
    Math.max(MULTITASK_DESKTOP_AGENT_COL_MIN_PX, usable * 0.32)
  );
  const chatCol = usable - agentCol;

  return chatCol > agentCol;
}

export function isArcadiaSubagentRunning(agent: Pick<ArcadiaSubagent, "status">): boolean {
  return ARCADIA_RUNNING_STATUSES.has(agent.status);
}

/**
 * Layout follows the per-thread user toggle only.
 * A working sandbox agent must not force the dashboard on.
 */
export function resolveArcadiaMultitaskLayoutMode(
  multitaskViewEnabled: boolean
): ArcadiaMultitaskLayoutMode {
  return multitaskViewEnabled ? "dashboard" : "overlay";
}

/**
 * Refuse toggles while this thread still has a live LLM stream.
 * `activeStreamId` mirrors `threads.active_stream_id` (or a client stream counter).
 */
export function canToggleArcadiaMultitaskView(args: {
  activeStreamId: string | null | undefined;
}): boolean {
  const id = args.activeStreamId?.trim();

  return !id;
}

export function formatSendTargetLabel(
  target: ArcadiaMultitaskSendTarget,
  agents: ReadonlyArray<Pick<ArcadiaSubagent, "id" | "name">>
): string {
  if (target.kind === "orchestrator") return "Orchestrator";

  const agent = agents.find((a) => a.id === target.agentId);

  return agent?.name ?? "Subagent";
}

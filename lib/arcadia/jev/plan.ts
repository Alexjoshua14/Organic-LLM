import type {
  JevAnalysis,
  JevModelRoute,
  JevPlan,
  JevResponseFormat,
  JevToolKey,
  JevTurnData,
} from "./types";

import {
  JEV_ACK_THRESHOLD,
  JEV_FORMAT_SWITCH_MIN_PROBABILITY,
  JEV_TOOL_ENABLE_THRESHOLD,
} from "./constants";
import { JEV_TOOL_KEYS, JEV_TURN_DATA_VERSION } from "./types";

/**
 * The composer's Search / Memory / message-search toggles. Jev can narrow what the composer
 * allows, never widen it: a group the user switched off stays off whatever Jev says.
 */
export type JevToolPermissions = { webSearch: boolean; memory: boolean; messageSearch: boolean };

/**
 * Groups whose output can stand in for prose. A tool-only reply with none of these enabled
 * would leave the model nothing to answer with, so the format drops back to text.
 */
const ARTIFACT_TOOL_KEYS: ReadonlySet<JevToolKey> = new Set<JevToolKey>([
  "mermaid_diagram",
  "gen_ui",
  "rabbit_hole",
  "task_management",
  "restaurant_lookup",
]);

function isToolPermitted(tool: JevToolKey, permissions: JevToolPermissions): boolean {
  switch (tool) {
    case "web_search":
      return permissions.webSearch;
    case "memory_search":
      return permissions.memory;
    case "chat_history":
      return permissions.messageSearch;
    default:
      // No composer toggle covers these groups, so only Jev decides.
      return true;
  }
}

/** Standard Arcadia's default for a group: on when permitted. Rabbit hole creation is Jev-only. */
function isStandardTool(tool: JevToolKey, permissions: JevToolPermissions): boolean {
  return tool !== "rabbit_hole" && isToolPermitted(tool, permissions);
}

function selectTools(analysis: JevAnalysis, permissions: JevToolPermissions): JevToolKey[] {
  const enabled = new Set<JevToolKey>();

  for (const tool of JEV_TOOL_KEYS) {
    const probability = analysis.toolProbabilities?.[tool];

    // A group Jev gave no reading for keeps Standard Arcadia's default rather than silently
    // losing the tool; a successful pass always answers every group, so this is defensive.
    const wanted =
      typeof probability === "number"
        ? probability >= JEV_TOOL_ENABLE_THRESHOLD && isToolPermitted(tool, permissions)
        : isStandardTool(tool, permissions);

    if (wanted) enabled.add(tool);
  }

  // Restaurant results render as cards through `render_gen_ui`.
  if (enabled.has("restaurant_lookup") && isToolPermitted("gen_ui", permissions)) {
    enabled.add("gen_ui");
  }

  return JEV_TOOL_KEYS.filter((tool) => enabled.has(tool));
}

function selectResponseFormat(
  analysis: JevAnalysis,
  tools: readonly JevToolKey[]
): JevResponseFormat {
  const reading = analysis.responseFormat;

  if (!reading || reading.choice === "text") return "text";

  const probability = reading.probabilities[reading.choice];

  if (typeof probability !== "number" || !(probability >= JEV_FORMAT_SWITCH_MIN_PROBABILITY)) {
    return "text";
  }

  if (reading.choice === "tool_result" && !tools.some((tool) => ARTIFACT_TOOL_KEYS.has(tool))) {
    return "text";
  }

  return reading.choice;
}

/**
 * Turns Jev's analysis into what the server does this turn: reply or acknowledge, which tool
 * groups the LLM gets, and the reply format. A fallback analysis runs the turn exactly like
 * Standard Arcadia (reply, text, the composer's toolset).
 */
export function planJevTurn(p: {
  analysis: JevAnalysis;
  permissions: JevToolPermissions;
  override: boolean;
}): JevPlan {
  const { analysis, permissions, override } = p;

  if (analysis.source === "fallback") {
    return {
      respond: true,
      responseFormat: "text",
      tools: JEV_TOOL_KEYS.filter((tool) => isStandardTool(tool, permissions)),
      override,
    };
  }

  const noReply = analysis.noReplyProbability;
  const acknowledgeOnly = typeof noReply === "number" && noReply >= JEV_ACK_THRESHOLD;
  const tools = selectTools(analysis, permissions);

  return {
    respond: override || !acknowledgeOnly,
    responseFormat: selectResponseFormat(analysis, tools),
    tools,
    override,
  };
}

/** Payload for the persisted `data-jev` part. `route` is present only when Jev routed the model. */
export function buildJevTurnData(p: {
  analysis: JevAnalysis;
  plan: JevPlan;
  route?: JevModelRoute;
}): JevTurnData {
  return {
    version: JEV_TURN_DATA_VERSION,
    outcome: p.plan.respond ? "respond" : "acknowledged",
    analysis: p.analysis,
    plan: p.plan,
    ...(p.route ? { route: p.route } : {}),
  };
}

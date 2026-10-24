import type { UIMessage } from "ai";

/**
 * When true, only the most recent help response in the thread shows the custom Arcadia
 * help UI; older help messages render as markdown. When false, every help message
 * shows the custom UI. Toggle at app level; remove one path once you settle.
 */
export const ARCADIA_HELP_LATEST_ONLY = true;

/**
 * Stable prefix for the Arcadia help message. Used by the client to detect and render
 * the custom ArcadiaHelpMessage component instead of markdown.
 */
export const ARCADIA_HELP_PREFIX = "**Arcadia** — sandbox chat";

/**
 * CLI-style "what can you do" copy for Arcadia. Shown when the user asks for help,
 * capabilities, or what Arcadia is. Mirrors highlights from the Arcadia podcast script.
 */
export const ARCADIA_HELP_RESPONSE = `**Arcadia** — sandbox chat inside Organic LLM. Same app, same threads; a dedicated place to experiment.

\`\`\`
CAPABILITIES
  concise         Short answers (~1 screen on mobile). Offer to expand if you need depth.
  tools-first     Prefer tool use over long prose. I synthesize; I don’t dump raw output.
  mermaid         Ask for a diagram → I generate Mermaid (flowcharts, sequences). Renders inline.

SANDBOX
  • New prompts, context shapes, tools, or UI ideas land here first.
  • Main chat stays stable. If something breaks, it’s only in Arcadia.

SIDEBAR (Coalescence Mode)
  • On:  One list — main + Arcadia threads (Arcadia rows: forest-green hint, brown-glass on hover).
  • Off: Main chat only. Arcadia threads still exist; open via sandbox or direct link.

Try: "Draw a flowchart for X" or "Summarize Y in three bullets."
\`\`\``;

const HELP_PATTERNS = [
  /^what\s+(can\s+you\s+do|do\s+you\s+do|are\s+you)\s*[?.!]?\s*$/i,
  /^help\s*[?.!]?\s*$/i,
  /^what\s+is\s+arcadia\s*[?.!]?\s*$/i,
  /^arcadia\s*[?.!]?\s*$/i,
  /^what\s+can\s+arcadia\s+do\s*[?.!]?\s*$/i,
  /^capabilities\s*[?.!]?\s*$/i,
  /^(\?\?|\\help)\s*$/,
];

/**
 * True if the user message looks like a help / "what can you do" request for Arcadia.
 */
export function isArcadiaHelpQuery(text: string): boolean {
  const t = text.trim().toLowerCase();

  if (!t) return false;

  return HELP_PATTERNS.some((p) => p.test(t));
}

/**
 * Extract plain text from the latest user message (parts or content).
 */
export function getLastUserMessageText(message: UIMessage): string {
  if (message.parts?.length) {
    return message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .reduce((acc, p) => acc + p.text, "")
      .trim();
  }
  const m = message as { content?: unknown };

  return typeof m.content === "string" ? m.content.trim() : "";
}

/**
 * Extract plain text from any message (for detecting help responses).
 */
export function getMessageText(message: UIMessage): string {
  return getLastUserMessageText(message);
}

/**
 * True if this message is an Arcadia help response (assistant message with help prefix).
 */
export function isArcadiaHelpMessage(message: UIMessage): boolean {
  return message.role === "assistant" && getMessageText(message).startsWith(ARCADIA_HELP_PREFIX);
}

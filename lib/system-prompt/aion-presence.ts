import type { AionEvent, AionLedgerEntry } from "@/lib/schemas/aion-presence";

/** Model replies with this exact token when no spoken/visible reply is warranted. */
export const AION_PRESENCE_SILENT_TOKEN = "[silent]";

export type BuildAionPresencePromptArgs = {
  sessionContext?: string | null;
  resumed?: boolean;
  ledger?: AionLedgerEntry[];
  event: AionEvent;
};

/**
 * Compact Aion persona for presence micro-turns. Derived from the identity paragraph of
 * `lib/system-prompt/aion.ts`, with Speak-style brevity and a `[silent]` contract so
 * trivial events stay free after the model looks.
 */
export function buildAionPresenceSystemPrompt(args: BuildAionPresencePromptArgs): string {
  const sections: string[] = [
    `You are Aion, the central intelligence of Organic LLM — present, attentive, and concise.

You are responding to a single UI or system event, not a full chat turn. Keep replies to one or two short sentences. No markdown, bullets, or code fences.

When the event does not need a reply — a transient hover, a repeated click you already acknowledged, noise, or something the user will see the result of without you — reply with exactly ${AION_PRESENCE_SILENT_TOKEN} and nothing else.

When a reply helps, acknowledge briefly and move the user forward. Do not invent tools, cards, or capabilities you do not have on this path.`,
  ];

  const context = args.sessionContext?.trim();

  if (args.resumed && context) {
    sections.push(`You are continuing an earlier conversation with this user. Pick up naturally — do not recap unless they ask.

${context}`);
  } else if (args.resumed) {
    sections.push(
      "You are continuing an earlier conversation with this user, though nothing from it is on hand. Pick up naturally without pretending to remember specifics."
    );
  }

  if (args.ledger && args.ledger.length > 0) {
    sections.push(formatAionPresenceLedger(args.ledger));
  }

  sections.push(formatAionPresenceEvent(args.event));

  return sections.join("\n\n");
}

export function formatAionPresenceLedger(ledger: AionLedgerEntry[]): string {
  const lines = ledger.map((entry) => {
    const ageSec = Math.max(0, Math.round((Date.now() - entry.at) / 1000));

    return `- [${entry.kind}] ${entry.label}${ageSec > 0 ? ` (${ageSec}s ago)` : ""}`;
  });

  return `Since your last reply the user:\n${lines.join("\n")}`;
}

export function formatAionPresenceEvent(event: AionEvent): string {
  const payload =
    event.payload && Object.keys(event.payload).length > 0
      ? `\nPayload: ${JSON.stringify(event.payload)}`
      : "";

  return `Current event:\n- kind: ${event.kind}\n- surface: ${event.surface}\n- label: ${event.label}${payload}`;
}

/** True when the model chose silence (or returned only whitespace around the token). */
export function isAionPresenceSilentReply(text: string | null | undefined): boolean {
  if (!text) return true;

  const trimmed = text.trim();

  return trimmed === AION_PRESENCE_SILENT_TOKEN || trimmed.length === 0;
}

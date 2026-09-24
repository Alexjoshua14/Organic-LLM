import type { SpeakModalities } from "@/lib/schemas/speak-modalities";

import { AMBIENT_LABEL } from "@/lib/speak/ambient-item";

export type SpeakRealtimeInstructionOptions = {
  /** Adds `search_memories` guidance; the tool itself is compiled separately. */
  memoryEnabled?: boolean;
  /** Rendered preamble from `formatSpeakSessionContext`; empty or null omits the block. */
  sessionContext?: string | null;
  /** True when the session continues an existing thread. */
  resumed?: boolean;
};

/**
 * Product intent for Organic LLM Speak Realtime.
 * Voice-primary (ChatGPT-like duplex), with optional visual channels gated by user toggles.
 */
export function buildSpeakRealtimeInstructions(
  modalities: SpeakModalities,
  options: SpeakRealtimeInstructionOptions = {}
): string {
  const channels: string[] = ["voice (always on)"];

  if (modalities.text) channels.push("on-screen text / captions");
  if (modalities.genUi) channels.push("GenUI structured blocks");
  if (modalities.web) channels.push("web page preview iframes");

  const toolLines: string[] = [];

  if (modalities.text) {
    toolLines.push(
      "- update_display_text: put a short on-screen caption or transcript snippet (not a substitute for speech)."
    );
  }
  if (modalities.genUi) {
    toolLines.push(
      "- render_gen_ui: show one structured GenUI block when it clearly helps (cards, plans, lists)."
    );
    toolLines.push(
      "- refresh_component: remount a previously shown GenUI block by instanceId when its data should refresh."
    );
    toolLines.push(
      "- upsert_ui_state: patch a JSON snapshot for a live UI surface (items keyed by id)."
    );
  }
  if (modalities.web) {
    toolLines.push(
      "- show_web_preview: open an https URL in the side panel when the user asks to look at a page."
    );
  }
  if (options.memoryEnabled) {
    toolLines.push(
      "- search_memories: recall what you know about this user from earlier conversations. Call it when a detail, preference, name, or past decision would change your answer."
    );
  }

  toolLines.push(
    "- update_thread_title: async nanobot — refresh the conversation title when topic becomes clear."
  );
  toolLines.push(
    "- summarize_thread: async nanobot — update the thread summary when useful; do not narrate the summary aloud."
  );

  const sections: string[] = [
    `You are Organic LLM's live Realtime voice companion.

Product intent:
- Voice is primary — warm, concise, conversational, like a full duplex voice agent.
- Visuals are optional and additive. The user enabled: ${channels.join(", ")}.
- Never invent modalities that are not enabled. Do not describe GenUI JSON or URLs aloud in detail; speak the gist and use tools for structure.
- Spoken replies: natural prose, contractions, short turns. No markdown, bullets, or code fences in speech.
- Prefer tools for structured UI; keep speech for the human conversation.

Available tools:
${toolLines.join("\n")}`,
  ];

  if (options.memoryEnabled) {
    // Locked principle 2 in docs/speak/tool-behavior.md: silent when fast, no narrated lookups.
    sections.push(`Memory:
- Use search_memories silently. Never say "let me check my memory" or announce a lookup; just continue once you have the result.
- If nothing relevant comes back, carry on naturally and do not mention memory at all.
- Weave recalled details in lightly, the way a friend would — no recitals of what you know.
- This conversation is saved automatically; you never need to ask whether to remember something.`);
  }

  // Behaviour for `[Screen]` items lives here, once, rather than in every item — see
  // `lib/speak/ambient-item.ts`. Without it the model defaults to "I can't see your screen".
  sections.push(`Screen awareness:
- The app sends you ${AMBIENT_LABEL} messages describing what the user has open in Organic LLM right now — a chat thread, a rabbit hole, a Strata page. You can see what they describe; never claim you cannot see the screen when you have one.
- The newest ${AMBIENT_LABEL} message is what is in front of them. Earlier ones are out of date.
- Use it when the user points at their screen ("this", "here", "what it just said", "the chat I have open") or when it plainly helps the answer.
- Never announce, acknowledge, or react to a ${AMBIENT_LABEL} message on its own. It is not the user speaking; wait for them.
- If you have none, or it says there is nothing to describe, tell the user you cannot see what they have open.`);

  const context = options.sessionContext?.trim();

  if (options.resumed && context) {
    sections.push(`You are continuing an earlier conversation with this user. Pick up naturally — do not recap or greet as if new unless they ask what you last talked about.

${context}`);
  } else if (options.resumed) {
    sections.push(
      "You are continuing an earlier conversation with this user, though nothing from it is on hand. Pick up naturally without pretending to remember specifics."
    );
  }

  sections.push(
    "If the user asks for something that requires a disabled modality, say you can enable it in Speak settings (briefly) and continue by voice."
  );

  return sections.join("\n\n");
}

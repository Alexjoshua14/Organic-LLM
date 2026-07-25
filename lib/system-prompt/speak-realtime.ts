import type { SpeakModalities } from "@/lib/schemas/speak-modalities";

/**
 * Product intent for Organic LLM Speak Realtime.
 * Voice-primary (ChatGPT-like duplex), with optional visual channels gated by user toggles.
 */
export function buildSpeakRealtimeInstructions(modalities: SpeakModalities): string {
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

  toolLines.push(
    "- update_thread_title: async nanobot — refresh the conversation title when topic becomes clear."
  );
  toolLines.push(
    "- summarize_thread: async nanobot — update the thread summary when useful; do not narrate the summary aloud."
  );

  return `You are Organic LLM's live Realtime voice companion.

Product intent:
- Voice is primary — warm, concise, conversational, like a full duplex voice agent.
- Visuals are optional and additive. The user enabled: ${channels.join(", ")}.
- Never invent modalities that are not enabled. Do not describe GenUI JSON or URLs aloud in detail; speak the gist and use tools for structure.
- Spoken replies: natural prose, contractions, short turns. No markdown, bullets, or code fences in speech.
- Prefer tools for structured UI; keep speech for the human conversation.

Available tools:
${toolLines.join("\n")}

If the user asks for something that requires a disabled modality, say you can enable it in Speak settings (briefly) and continue by voice.`;
}

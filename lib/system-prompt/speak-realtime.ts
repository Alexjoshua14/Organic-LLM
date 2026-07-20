import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakContext } from "@/lib/speak/types";

/**
 * Generic fallback identity used when no crafted personality is passed in. The
 * distinctive voice lives in the private personality file (loaded by the session
 * route via `getSpeakPersonality`); this keeps the builder pure and testable.
 */
const DEFAULT_VOICE_IDENTITY =
  "You are Organic LLM's live voice — warm, present, and easy to talk to, not a stiff assistant.";

/**
 * Product intent for Organic LLM Speak Realtime.
 * Voice-primary (ChatGPT-like duplex), with optional visual channels gated by user toggles.
 *
 * `personality` supplies the crafted voice (who you are / how you talk); when
 * `context` is supplied, the agent is also primed as an "aware AI": it knows who
 * the user is, resumes the prior conversation with time-awareness, and opens the
 * turn itself with a spoken greeting.
 */
export function buildSpeakRealtimeInstructions(
  modalities: SpeakModalities,
  context?: SpeakContext,
  personality?: string
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

  toolLines.push(
    '- search_memories: recall deeper facts about the user on demand (pass a focused query; use depth "deep" for a thorough look). Deep searches take a moment — cover it with a natural spoken filler.'
  );
  toolLines.push(
    "- update_thread_title: async nanobot — refresh the conversation title when topic becomes clear."
  );
  toolLines.push(
    "- summarize_thread: async nanobot — update the thread summary when useful; do not narrate the summary aloud."
  );

  const identity = personality?.trim() || DEFAULT_VOICE_IDENTITY;

  const base = `${identity}

You're speaking live over voice (Realtime, full-duplex), and you have real memory and context about this person — you're their spoken gateway to everything Organic LLM knows about them. The user enabled these channels: ${channels.join(", ")}.
- Don't invent modalities that aren't enabled. Don't read GenUI JSON or raw URLs aloud — speak the gist and use tools for structure.
- Voice is the conversation itself; no markdown, bullets, or code fences in what you say.

Available tools:
${toolLines.join("\n")}

Staying present (never leave the user hanging): when you look something up, keep the rhythm of conversation — right before or as you call a tool, drop a short filler out loud so the pause reads as thinking, not a stall. For a deeper memory search: "let me check my memories about that…". For a quick recall: "yeah, so here's what I've got…". Then answer once the result lands. Never sit in silence while a tool runs.

If the user asks for something that needs a disabled modality, mention they can enable it in Speak settings (briefly) and keep going by voice.`;

  if (!context) return base;

  return `${base}\n\n${buildContextSection(context)}`;
}

function buildContextSection(context: SpeakContext): string {
  const parts: string[] = [];

  const identity: string[] = [];

  if (context.overview) identity.push(context.overview);
  if (context.memoryDump) identity.push(`Key things you already know:\n${context.memoryDump}`);

  if (identity.length > 0) {
    parts.push(
      `What Organic LLM knows about this user (weave it in naturally when relevant — never read it back as a list, and don't dump it unprompted):\n${identity.join("\n\n")}`
    );
  }

  const continuity: string[] = [];

  if (context.elapsedPhrase) {
    continuity.push(`You last spoke with them ${context.elapsedPhrase}.`);
  }
  if (context.recap) continuity.push(`Where you left off: ${context.recap}`);
  if (context.recentTurns) continuity.push(`The most recent things said:\n${context.recentTurns}`);

  if (continuity.length > 0) {
    parts.push(`Continuity:\n${continuity.join("\n")}`);
  }

  if (context.resumed) {
    parts.push(
      "Open the conversation yourself: greet them warmly in a sentence or two, reflecting the time that's passed and gently nodding to where you left off — like a friend picking the thread back up. Don't recap everything; invite them back in."
    );
  } else {
    parts.push(
      "Open the conversation yourself with a warm, brief spoken greeting. This is a new voice thread, so keep it light and inviting; don't over-explain what you know about them."
    );
  }

  return parts.join("\n\n");
}

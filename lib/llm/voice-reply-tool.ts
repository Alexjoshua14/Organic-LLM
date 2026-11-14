import { tool, type Tool } from "ai";

import {
  clampVoiceScript,
  VOICE_REPLY_MAX_SECONDS,
  VOICE_REPLY_MAX_WORDS,
} from "@/lib/arcadia/jev/voice";
import { createLogger } from "@/lib/logger";
import {
  VOICE_REPLY_TOOL_NAME,
  VoiceReplyInputSchema,
  type VoiceReplyInput,
  type VoiceReplyOutput,
} from "@/lib/schemas/jev-tools";

const logger = createLogger("lib/llm/voice-reply-tool.ts");

const ALREADY_USED_MESSAGE = `${VOICE_REPLY_TOOL_NAME} was already used for this reply.`;
const EMPTY_SCRIPT_MESSAGE = `${VOICE_REPLY_TOOL_NAME} needs a script with words to speak.`;

/**
 * Arcadia Jev mode: delivers the reply as speech. The tool only trims the script to the
 * 30-second cap; the in-chat player fetches the audio from `/api/ai/tts-v2` when it renders the
 * part, so nothing is synthesized for a reply nobody plays.
 *
 * Create one per turn: the instance remembers its first successful call and refuses the rest,
 * so a reply never carries two players.
 */
export function createVoiceReplyTool(): Tool<VoiceReplyInput, VoiceReplyOutput> {
  let callsThisTurn = 0;
  let used = false;

  return tool({
    description: `Speak this reply aloud: the app plays your script in an in-chat audio player. Call exactly once, as your last action, when the reply should be heard. Hard limit: ${VOICE_REPLY_MAX_SECONDS} seconds of speech (about ${VOICE_REPLY_MAX_WORDS} words); longer scripts are cut off. Write plain spoken sentences — no markdown, lists, URLs, emoji, or code. Put anything that must be read rather than heard (code, links, exact figures) in onScreen.`,
    inputSchema: VoiceReplyInputSchema,
    execute: async ({ script, onScreen }): Promise<VoiceReplyOutput> => {
      callsThisTurn += 1;

      if (used) {
        logger.warn("voice_reply", "repeat call refused", {
          event: "voice_reply_repeat_call",
          callIndex: callsThisTurn,
        });

        return { ok: false, message: ALREADY_USED_MESSAGE };
      }

      const clamped = clampVoiceScript(script);

      // The schema accepts whitespace-only strings; an empty script would give the player nothing
      // to synthesize. Refuse without spending the turn's one call.
      if (!clamped.script) {
        logger.warn("voice_reply", "empty script refused", {
          event: "voice_reply_empty_script",
          callIndex: callsThisTurn,
        });

        return { ok: false, message: EMPTY_SCRIPT_MESSAGE };
      }

      used = true;

      const screenText = onScreen?.trim();

      logger.log("voice_reply", "voice reply prepared", {
        event: "voice_reply_prepared",
        words: clamped.words,
        truncated: clamped.truncated,
        hasOnScreen: Boolean(screenText),
        callIndex: callsThisTurn,
      });

      return {
        ok: true,
        script: clamped.script,
        ...(screenText ? { onScreen: screenText } : {}),
        truncated: clamped.truncated,
        maxSeconds: VOICE_REPLY_MAX_SECONDS,
      };
    },
  });
}

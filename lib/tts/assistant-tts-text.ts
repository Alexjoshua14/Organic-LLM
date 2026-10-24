import { splitTextIntoSegments } from "@/lib/tts/token-calculator";

/** Text passed to TTS for one assistant message, given user “whole message” preference. */
export function assistantTtsTextToPlay(text: string, ttsWholeMessage: boolean): string {
  return ttsWholeMessage ? text : (splitTextIntoSegments(text, "paragraph")[0] ?? text);
}

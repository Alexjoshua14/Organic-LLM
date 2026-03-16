/**
 * Speech-control tags the LLM may insert for better delivery.
 * Strip these before sending to TTS (use stripSpeechTags); future pipelines can map them to SSML or insert pauses.
 *
 * - <breath/> or <breath length="short|medium|long"/> — natural breath / micro-pause
 * - <pause length="short|medium|long"/> — deliberate pause (e.g. after a list, before emphasis)
 * - <pace speed="slower|normal|faster"/> — change speaking rate for the following segment
 * - <tone type="softer|emphatic|neutral|warm"/> — delivery tone hint
 */
const SPEECH_TAG_PATTERN = /<\s*(?:breath|pause|pace|tone)(?:\s+[^>]*)?\s*\/?>/gi;

/**
 * Removes speech-control tags from text so it can be sent to TTS engines that expect plain text.
 */
export function stripSpeechTags(text: string): string {
  return text
    .replace(SPEECH_TAG_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

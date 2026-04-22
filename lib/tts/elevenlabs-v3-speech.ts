/** API / UI identifier for the ElevenLabs Eleven v3 speech synthesis model. */
export const ELEVENLABS_V3_SPEECH_MODEL_ID = "eleven_v3" as const;

export type ElevenLabsV3SpeechModelId = typeof ELEVENLABS_V3_SPEECH_MODEL_ID;

export function isElevenLabsV3SpeechModelId(
  model: string | undefined | null
): model is ElevenLabsV3SpeechModelId {
  return model === ELEVENLABS_V3_SPEECH_MODEL_ID;
}

import z from "zod";

// Schema for character-level alignment data for text-to-speech.
// - characters: array of text characters in speech
// - characterStartTimesSeconds: array of start timestamps for each character (seconds)
// - characterEndTimesSeconds: array of end timestamps for each character (seconds)
export const AlignmentSchema = z.object({
  characters: z.array(z.string()),
  characterStartTimesSeconds: z.array(z.number()),
  characterEndTimesSeconds: z.array(z.number()),
});

// Represents one chunk of audio streamed from TTS API, optionally with alignment info.
// - audioBase64: base64-encoded audio data (MP3 or similar)
// - alignment: optional original alignment metadata for this chunk
// - normalizedAlignment: optional time-normalized alignment metadata
export const AudioStreamChunkSchema = z.object({
  audioBase64: z.string(),
  alignment: AlignmentSchema.optional(),
  normalizedAlignment: AlignmentSchema.optional(),
});

// Type for character alignment data structure used throughout TTS code.
export type AlignmentData = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

// Type for one streamed audio chunk (from the AudioStreamChunkSchema)
export type AudioStreamChunk = z.infer<typeof AudioStreamChunkSchema>;

// Type for alignment schema object
export type Alignment = z.infer<typeof AlignmentSchema>;

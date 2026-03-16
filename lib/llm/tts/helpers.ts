import { AudioStreamChunk, AudioStreamChunkSchema, type AlignmentData } from "@/lib/schemas/tts";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/llm/tts/helpers.ts");

const MIN_BUFFERED_SECONDS = 0.5;

/**
 * Estimates time in milliseconds based on MP3 at 128kbps, which == 16KB per second
 * @param chunk
 */
export function calculateChunkLength(chunk: AudioStreamChunk): number {
  const chunkSizeBytes = atob(chunk.audioBase64).length;

  return chunkSizeBytes / 16384;
}

/**
 * Helper function to merge multiple alignment chunks into a single alignment.
 * Each chunk from the TTS API has timestamps relative to the start of that chunk's
 * audio, so we must add a time offset for every chunk after the first (cumulative
 * duration of all previous chunks).
 */
export function mergeAlignments(
  alignments: Array<{
    alignment?: AlignmentData;
    normalizedAlignment?: AlignmentData;
  }>
): { alignment?: AlignmentData; normalizedAlignment?: AlignmentData } | null {
  if (alignments.length === 0) return null;

  const mergedAlignment: AlignmentData = {
    characters: [],
    characterStartTimesSeconds: [],
    characterEndTimesSeconds: [],
  };

  const mergedNormalized: AlignmentData = {
    characters: [],
    characterStartTimesSeconds: [],
    characterEndTimesSeconds: [],
  };

  let hasAlignment = false;
  let hasNormalized = false;

  // Global offset (seconds): position on the merged timeline for the next chunk.
  // Each chunk's timestamps are relative to that chunk; we add this offset so
  // the merged alignment has a single continuous timeline.
  let alignmentOffsetSeconds = 0;
  let normalizedOffsetSeconds = 0;

  for (const chunk of alignments) {
    if (chunk.alignment) {
      const a = chunk.alignment;

      mergedAlignment.characters.push(...a.characters);
      mergedAlignment.characterStartTimesSeconds.push(
        ...a.characterStartTimesSeconds.map((t) => t + alignmentOffsetSeconds)
      );
      mergedAlignment.characterEndTimesSeconds.push(
        ...a.characterEndTimesSeconds.map((t) => t + alignmentOffsetSeconds)
      );
      // Next chunk's alignment starts after this chunk's end time
      const lastEnd = a.characterEndTimesSeconds[a.characterEndTimesSeconds.length - 1];

      alignmentOffsetSeconds += lastEnd ?? 0;
      hasAlignment = true;
    }
    if (chunk.normalizedAlignment) {
      const n = chunk.normalizedAlignment;

      mergedNormalized.characters.push(...n.characters);
      mergedNormalized.characterStartTimesSeconds.push(
        ...n.characterStartTimesSeconds.map((t) => t + normalizedOffsetSeconds)
      );
      mergedNormalized.characterEndTimesSeconds.push(
        ...n.characterEndTimesSeconds.map((t) => t + normalizedOffsetSeconds)
      );
      const lastEnd = n.characterEndTimesSeconds[n.characterEndTimesSeconds.length - 1];

      normalizedOffsetSeconds += lastEnd ?? 0;
      hasNormalized = true;
    }
  }

  return {
    alignment: hasAlignment ? mergedAlignment : undefined,
    normalizedAlignment: hasNormalized ? mergedNormalized : undefined,
  };
}

/**
 * Wait for sourceBuffer to be ready before appending
 */
export async function waitForSourceBuffer(sourceBuffer: SourceBuffer): Promise<void> {
  return new Promise((resolve) => {
    if (!sourceBuffer.updating) {
      return resolve();
    }
    sourceBuffer.addEventListener("updateend", () => resolve(), { once: true });
  });
}

/**
 * Decode base64 audio string to Uint8Array
 */
export function decodeAudioBase64(audioBase64: string): Uint8Array {
  return Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
}

/**
 * Process alignment data from a TTS audio chunk.
 * - Calls the onAlignment callback and accumulates all alignments for later merging.
 *
 * @param chunk - The audio chunk with optional alignment and normalizedAlignment data
 * @param callbacks - Object containing:
 *   - onAlignment: Optional callback fired for each chunk's alignment data (for UI highlighting, etc.)
 *   - setAllAlignments: State setter for accumulating all received alignment data (for merging at end)
 */
export function processAlignmentData(
  chunk: { alignment?: AlignmentData; normalizedAlignment?: AlignmentData },
  callbacks: {
    onAlignment?: (data: {
      alignment?: AlignmentData;
      normalizedAlignment?: AlignmentData;
    }) => void;
    setAllAlignments: React.Dispatch<
      React.SetStateAction<
        Array<{
          alignment?: AlignmentData;
          normalizedAlignment?: AlignmentData;
        }>
      >
    >;
  }
): void {
  // Only process if at least one type of alignment is present in the chunk
  if (chunk.alignment || chunk.normalizedAlignment) {
    const alignmentData = {
      alignment: chunk.alignment,
      normalizedAlignment: chunk.normalizedAlignment,
    };

    // Trigger any registered callback for new alignment data (e.g. for real-time highlighting)
    callbacks.onAlignment?.(alignmentData);

    // Accumulate all alignment data so we can later merge for a full alignment for the audio
    callbacks.setAllAlignments((prev) => [...prev, alignmentData]);

    // Debug/log for development purposes
    logger.log("streamAudio", `Alignment data received:`, {
      hasAlignment: !!chunk.alignment,
      hasNormalized: !!chunk.normalizedAlignment,
      alignmentChars: chunk.alignment?.characters.length,
      normalizedChars: chunk.normalizedAlignment?.characters.length,
    });
  }
}

/**
 * Process a single audio chunk: extract alignment, decode audio, and append to a SourceBuffer.
 *
 * @param chunk - An audio chunk which may have alignment info and base64-encoded audio data
 * @param sourceBuffer - The MediaSource SourceBuffer to append decoded audio bytes to
 * @param callbacks - Object containing onAlignment and setAllAlignments for alignment processing
 */
export async function processAudioChunk(
  chunk: {
    audioBase64: string;
    alignment?: AlignmentData;
    normalizedAlignment?: AlignmentData;
  },
  sourceBuffer: SourceBuffer,
  callbacks: {
    onAlignment?: (data: {
      alignment?: AlignmentData;
      normalizedAlignment?: AlignmentData;
    }) => void;
    setAllAlignments: React.Dispatch<
      React.SetStateAction<
        Array<{
          alignment?: AlignmentData;
          normalizedAlignment?: AlignmentData;
        }>
      >
    >;
    /** Optional: called with raw audio bytes for each chunk (e.g. for caching the full response). */
    onAudioChunk?: (bytes: Uint8Array) => void;
  }
): Promise<void> {
  // Skip if there's no audio data
  if (!chunk.audioBase64) return;

  // Process any alignment metadata in the chunk
  processAlignmentData(chunk, callbacks);

  // Decode base64 audio to Uint8Array and append to the MediaSource SourceBuffer
  const audioBytes = decodeAudioBase64(chunk.audioBase64);

  callbacks.onAudioChunk?.(audioBytes);
  await waitForSourceBuffer(sourceBuffer); // Wait for buffer to be ready (not updating)
  sourceBuffer.appendBuffer(audioBytes as BufferSource);
}

/**
 * Process an NDJSON stream of audio chunks, appending each to a SourceBuffer as they arrive.
 * Also calls an onReadyToPlay callback as soon as a minimum buffered audio duration is met.
 *
 * @param reader - A stream reader for the NDJSON audio+alignment data (from fetch response)
 * @param sourceBuffer - The MediaSource SourceBuffer to append decoded audio to
 * @param callbacks - Object containing:
 *   - onAlignment: Per-chunk alignment event callback
 *   - setAllAlignments: Cumulative state setter for alignments
 *   - onReadyToPlay: Called once enough buffer is present for responsive playback
 * @returns The remainder of the textual buffer (part of a possibly incomplete last chunk)
 */
export async function processAudioStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  sourceBuffer: SourceBuffer,
  callbacks: {
    onAlignment?: (data: {
      alignment?: AlignmentData;
      normalizedAlignment?: AlignmentData;
    }) => void;
    setAllAlignments: React.Dispatch<
      React.SetStateAction<
        Array<{
          alignment?: AlignmentData;
          normalizedAlignment?: AlignmentData;
        }>
      >
    >;
    onReadyToPlay?: () => Promise<void>;
    onAudioChunk?: (bytes: Uint8Array) => void;
  }
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  // let totalBufferedTime = 0; // Unused, but might track cumulative buffered seconds
  let hasCalledReadyToPlay = false;

  let i = 0; // Counter for debug logging

  while (true) {
    logger.log("processAudioStream", `${i} iteration`);
    const { value, done } = await reader.read();

    if (done) break;

    // Decode incoming bytes, accumulate to buffer, then split by newline for NDJSON lines
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    // The last element may be an incomplete JSON object, so keep it in buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue; // skip empty lines

      try {
        // Parse and validate the chunk's structure
        const chunk = AudioStreamChunkSchema.parse(JSON.parse(line));

        // Process audio and alignment for this chunk
        await processAudioChunk(chunk, sourceBuffer, callbacks);

        // Calculate how much audio is buffered in seconds
        const actualBufferedTime =
          sourceBuffer.buffered.length > 0
            ? sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1) -
              sourceBuffer.buffered.start(0)
            : 0;

        // As soon as we have enough buffered audio, trigger the "ready to play" event (once)
        if (!hasCalledReadyToPlay && actualBufferedTime >= MIN_BUFFERED_SECONDS) {
          hasCalledReadyToPlay = true;
          await callbacks.onReadyToPlay?.();
        }
      } catch (err) {
        // If the NDJSON is incomplete/corrupt on this line, log and skip
        logger.error("streamAudio", `Error parsing chunk: ${err}`);
      }
    }
    i++; // increment debug iteration count
  }

  // Return any unparsed trailing buffer (outside the loop) for possible final processing
  return buffer;
}

/**
 * Helper function to get the current character index being spoken
 * based on the current audio time and alignment data
 */
export function getCurrentCharacterIndex(
  currentTime: number,
  alignment: AlignmentData
): number | null {
  if (!alignment || !alignment.characterStartTimesSeconds || !alignment.characterEndTimesSeconds) {
    return null;
  }

  for (let i = 0; i < alignment.characterStartTimesSeconds.length; i++) {
    const startTime = alignment.characterStartTimesSeconds[i];
    const endTime = alignment.characterEndTimesSeconds[i];

    if (currentTime >= startTime && currentTime <= endTime) {
      return i;
    }
  }

  return null;
}

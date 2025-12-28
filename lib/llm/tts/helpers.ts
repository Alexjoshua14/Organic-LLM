import {
  AudioStreamChunk,
  AudioStreamChunkSchema,
  type AlignmentData,
} from "@/lib/schemas/tts";
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
 * Helper function to merge multiple alignment chunks into a single alignment
 * Useful when you want to combine all chunks into one complete alignment
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

  for (const chunk of alignments) {
    if (chunk.alignment) {
      mergedAlignment.characters.push(...chunk.alignment.characters);
      mergedAlignment.characterStartTimesSeconds.push(
        ...chunk.alignment.characterStartTimesSeconds
      );
      mergedAlignment.characterEndTimesSeconds.push(
        ...chunk.alignment.characterEndTimesSeconds
      );
      hasAlignment = true;
    }
    if (chunk.normalizedAlignment) {
      mergedNormalized.characters.push(...chunk.normalizedAlignment.characters);
      mergedNormalized.characterStartTimesSeconds.push(
        ...chunk.normalizedAlignment.characterStartTimesSeconds
      );
      mergedNormalized.characterEndTimesSeconds.push(
        ...chunk.normalizedAlignment.characterEndTimesSeconds
      );
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
export async function waitForSourceBuffer(
  sourceBuffer: SourceBuffer
): Promise<void> {
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
export function decodeAudioBase64(
  audioBase64: string
): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
}

/**
 * Process alignment data from a chunk
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
  if (chunk.alignment || chunk.normalizedAlignment) {
    const alignmentData = {
      alignment: chunk.alignment,
      normalizedAlignment: chunk.normalizedAlignment,
    };

    callbacks.onAlignment?.(alignmentData);
    callbacks.setAllAlignments((prev) => [...prev, alignmentData]);

    logger.log("streamAudio", `Alignment data received:`, {
      hasAlignment: !!chunk.alignment,
      hasNormalized: !!chunk.normalizedAlignment,
      alignmentChars: chunk.alignment?.characters.length,
      normalizedChars: chunk.normalizedAlignment?.characters.length,
    });
  }
}

/**
 * Process a single audio chunk: extract alignment, decode, and append to sourceBuffer
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
  }
): Promise<void> {
  if (!chunk.audioBase64) return;

  // Process alignment data
  processAlignmentData(chunk, callbacks);

  // Decode and append audio
  const audioBytes = decodeAudioBase64(chunk.audioBase64);
  await waitForSourceBuffer(sourceBuffer);
  sourceBuffer.appendBuffer(audioBytes);
}

/**
 * Process NDJSON stream and append audio chunks to sourceBuffer
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
  }
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let totalBufferedTime = 0;
  let hasCalledReadyToPlay = false;

  let i = 0;
  while (true) {
    logger.log("processAudioStream", `${i} iteration`);
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const chunk = AudioStreamChunkSchema.parse(JSON.parse(line));
        await processAudioChunk(chunk, sourceBuffer, callbacks);

        const actualBufferedTime =
          sourceBuffer.buffered.length > 0
            ? sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1) -
              sourceBuffer.buffered.start(0)
            : 0;

        // Mark audio as ready to play once we have enough buffer
        if (
          !hasCalledReadyToPlay &&
          actualBufferedTime >= MIN_BUFFERED_SECONDS
        ) {
          hasCalledReadyToPlay = true;
          await callbacks.onReadyToPlay?.();
        }
      } catch (err) {
        logger.error("streamAudio", `Error parsing chunk: ${err}`);
      }
    }
  }

  return buffer; // Return remaining buffer
}

/**
 * Helper function to get the current character index being spoken
 * based on the current audio time and alignment data
 */
export function getCurrentCharacterIndex(
  currentTime: number,
  alignment: AlignmentData
): number | null {
  if (
    !alignment ||
    !alignment.characterStartTimesSeconds ||
    !alignment.characterEndTimesSeconds
  ) {
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

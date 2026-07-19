import { splitTextIntoSegments } from "@/lib/tts/token-calculator";

const DEFAULT_MAX_CHUNK_CHARS = 4_000;

/**
 * Split long read-aloud text into TTS-safe chunks at paragraph boundaries.
 */
export function chunkTextForSpeak(text: string, maxChunkChars = DEFAULT_MAX_CHUNK_CHARS): string[] {
  const paragraphs = splitTextIntoSegments(text, "paragraph");

  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      const sentences = splitTextIntoSegments(paragraph, "sentence");

      for (const sentence of sentences) {
        if ((current + " " + sentence).trim().length > maxChunkChars) {
          if (current) chunks.push(current.trim());
          current = sentence;
        } else {
          current = current ? `${current} ${sentence}` : sentence;
        }
      }

      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length > maxChunkChars) {
      if (current) chunks.push(current.trim());
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

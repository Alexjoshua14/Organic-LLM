'use client'

import { createLogger } from "@/lib/logger"
import { Button } from "@heroui/button";
import { AudioLines, AudioWaveformIcon, Speaker } from "lucide-react";
import z from "zod";
import { glass } from "../design-system/primitives";

const logger = createLogger("components/tts/ttsButton-v2.tsx");


export default function TTSButtonV2() {

  return (
    <div>
      <Button
        onPress={streamAudio}
        className={
          `${glass()} transition-transform duration-300 active:scale-90 hover:scale-105 hover:shadow-lg`
        }
      >
        <AudioLines color="var(--accent)" className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90" />
      </Button>
    </div>
  )
}

const AlignmentSchema = z.object({
  characters: z.array(z.string()),
  characterStartTimesSeconds: z.array(z.number()),
  characterEndTimesSeconds: z.array(z.number()),
})

const AudioStreamChunkSchema = z.object({
  audioBase64: z.string(),
  alignment: AlignmentSchema.optional(),
  normalizedAlignment: AlignmentSchema.optional(),
})

export async function streamAudio() {
  const mediaSource = new MediaSource()

  const audio = new Audio(URL.createObjectURL(mediaSource))

  mediaSource.addEventListener("sourceopen", async () => {
    const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");

    const res = await fetch("/api/ai/tts-v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Hello, this is a test of the streaming TTS system.",
        model: "eleven_multilingual_v2",
        skipTransform: true,
      }),
    })

    if (!res.body) {
      logger.error("streamAudio", "No response body")
      mediaSource.endOfStream();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const chunk = AudioStreamChunkSchema.parse(JSON.parse(line));

          if (chunk.audioBase64) {
            const audioBytes = Uint8Array.from(
              atob(chunk.audioBase64),
              c => c.charCodeAt(0)
            );

            await new Promise(resolve => {
              if (!sourceBuffer.updating) {
                return resolve(null);
              }
              sourceBuffer.addEventListener("updateend", resolve, { once: true })

              // Can also access chunk.alignment and chunk.normalizedAlignment here
            })
            sourceBuffer.appendBuffer(audioBytes);
          }
        } catch (err) {
          logger.error("streamAudio", `Error parsing chunk: ${err}`)
        }
      }
    }

    // Handle any remaining buffer
    if (buffer.trim()) {
      try {
        const chunk = AudioStreamChunkSchema.parse(JSON.parse(buffer));
        if (chunk.audioBase64) {
          const audioBytes = Uint8Array.from(
            atob(chunk.audioBase64),
            c => c.charCodeAt(0)
          );
          await new Promise(resolve => {
            if (!sourceBuffer.updating) {
              return resolve(null);
            }
            sourceBuffer.addEventListener("updateend", resolve, { once: true });
          });
          sourceBuffer.appendBuffer(audioBytes);
        }
      } catch (err) {
        logger.error("streamAudio", `Error parsing final chunk: ${err}`);
      }
    }

    // Wait for sourceBuffer to finish any pending updates
    await new Promise(resolve => {
      if (!sourceBuffer.updating) {
        return resolve(null);
      }
      sourceBuffer.addEventListener("updateend", resolve, { once: true });
    });

    // Mark end of stream
    mediaSource.endOfStream();

    // Autoplay
    // Wait a bit for MediaSource to be ready, then play
    try {
      await audio.play();
    } catch (err) {
      logger.error("streamAudio", `Error playing audio: ${err}`);
    }
  });
}
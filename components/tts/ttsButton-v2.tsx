'use client'

import { createLogger } from "@/lib/logger"
import { Button } from "@heroui/button";
import { AudioLines } from "lucide-react";
import { glass } from "../design-system/primitives";
import { useRef, type ReactNode } from "react";
import { useTTS, AlignmentData } from "@/hooks/use-tts";

const logger = createLogger("components/tts/ttsButton-v2.tsx");


export default function TTSButtonV2({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  const speech = useTTS({
    audioRef,
    onAlignment: (alignmentData) => {
      // This callback is called for each chunk that contains alignment data
      // You can use this for real-time text highlighting, karaoke effects, etc.
      if (alignmentData.normalizedAlignment) {
        logger.log("TTSButtonV2", "Normalized alignment received:", {
          characters: alignmentData.normalizedAlignment.characters,
          startTimes: alignmentData.normalizedAlignment.characterStartTimesSeconds,
          endTimes: alignmentData.normalizedAlignment.characterEndTimesSeconds,
        });
      }
      if (alignmentData.alignment) {
        logger.log("TTSButtonV2", "Original alignment received:", {
          characters: alignmentData.alignment.characters,
        });
      }
    },
  });



  // Render text with highlighted characters
  const renderHighlightedText = () => {
    if (!speech.mergedAlignment || speech.currentCharacterIndices.size === 0) {
      return <span>{text}</span>;
    }

    // Use normalized alignment if available, otherwise original
    const alignment = speech.mergedAlignment.normalizedAlignment || speech.mergedAlignment.alignment;
    if (!alignment) {
      return <span>{text}</span>;
    }

    // Map character indices to text positions
    // Since alignment might have different characters than original text,
    // we'll highlight based on the alignment characters themselves
    const elements: ReactNode[] = [];

    for (let i = 0; i < alignment.characters.length; i++) {
      const char = alignment.characters[i];
      const isHighlighted = speech.currentCharacterIndices.has(i);

      if (isHighlighted) {
        elements.push(
          <span
            key={i}
            className="bg-yellow-400 dark:bg-yellow-600 text-black dark:text-white px-0.5 rounded transition-colors duration-75"
          >
            {char}
          </span>
        );
      } else {
        elements.push(
          <span key={i} className="opacity-60">
            {char}
          </span>
        );
      }
    }

    return <span>{elements}</span>;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full flex items-center justify-center">
        <p>
          {speech.status}
        </p>
      </div>
      <div className="flex flex-col gap-2 items-center text-default">
        <div className="flex flex-col gap-2 h-24 items-center w-full">
          <Button
            onPress={() => speech.streamAudio({ text })}
            className={
              `${glass()} transition-transform duration-300 active:scale-90 hover:scale-105 hover:shadow-lg h-14`
            }
          >
            <AudioLines color="var(--accent)" className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90" />
          </Button>
          <audio
            ref={audioRef}
            controls
            className={`w-full ${['ready', 'processing'].includes(speech.status) ? 'hidden' : ''}`}
          />
        </div>
        <div className="h-10 w-full overflow-auto">
          <div className="text-sm leading-relaxed wrap-break-word">
            {renderHighlightedText()}
          </div>
        </div>
      </div>
    </div>
  )
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


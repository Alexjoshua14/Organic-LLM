"use client";

/**
 * PrototypeDisplay - Demo component showing how to use prototypes
 * 
 * This component demonstrates usage with the useSimulateStream hook for demo purposes.
 * 
 * In a real app, you would typically use prototypes directly with AI SDK:
 * ```tsx
 * // Direct usage with AI SDK
 * const [text, setText] = useState("");
 * const [isStreaming, setIsStreaming] = useState(false);
 * 
 * // In your AI SDK handler:
 * for await (const chunk of textStream) {
 *   setText(prev => prev + chunk);
 *   setIsStreaming(true);
 * }
 * setIsStreaming(false);
 * 
 * // Render:
 * <TypewriterPrototype text={text} isStreaming={isStreaming} showCursor={true} />
 * ```
 */

import { useState } from "react";
import { Button } from "@/components/base";
import { TypewriterPrototype } from "./prototypes/TypewriterPrototype";
import { RipplePrototype } from "./prototypes/RipplePrototype";
import { SharedControls } from "./SharedControls";
import { TypewriterControls } from "./TypewriterControls";
import { RippleControls } from "./RippleControls";
import { StreamMode } from "./prototypes/types";
import { useSimulateStream } from "../hooks/useSimulateStream";

interface PrototypeDisplayProps {
  prototypeId: string;
}

export function PrototypeDisplay({ prototypeId }: PrototypeDisplayProps) {
  // Source text (simulates AI SDK stream)
  const [sourceText, setSourceText] = useState(
    "This is a sample text that will stream in with different granularities. You can customize the text, speed, and streaming mode to see how it affects the animation."
  );

  // Controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(50);
  const [streamMode, setStreamMode] = useState<StreamMode>("character");
  const [shouldLoop, setShouldLoop] = useState(true);

  // Prototype-specific state
  const [showCursor, setShowCursor] = useState(true);
  const [highlightColor, setHighlightColor] = useState("var(--color-accent-ember)");
  const [transitionDuration, setTransitionDuration] = useState(150);

  // Use simulation hook to generate streaming text
  const { text, isStreaming, reset } = useSimulateStream({
    sourceText,
    chunkMode: streamMode,
    speed,
    isPlaying,
    shouldLoop,
  });

  const handlePlayPause = () => {
    // If at end, restart
    if (!isPlaying && text.length >= sourceText.length) {
      reset();
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    reset();
    setIsPlaying(false);
  };

  const handleStreamModeChange = (mode: StreamMode) => {
    setStreamMode(mode);
    handleRestart();
  };

  const handleTextChange = (newText: string) => {
    setSourceText(newText);
    handleRestart();
  };

  // Prototype configuration
  const prototypeConfig = {
    typewriter: {
      component: (
        <TypewriterPrototype
          text={text}
          isStreaming={isStreaming}
          showCursor={showCursor}
        />
      ),
      specificControls: (
        <TypewriterControls
          showCursor={showCursor}
          onShowCursorChange={setShowCursor}
        />
      ),
    },
    ripple: {
      component: (
        <RipplePrototype
          text={text}
          isStreaming={isStreaming}
          highlightColor={highlightColor}
          transitionDuration={transitionDuration}
        />
      ),
      specificControls: (
        <RippleControls
          highlightColor={highlightColor}
          onHighlightColorChange={setHighlightColor}
          transitionDuration={transitionDuration}
          onTransitionDurationChange={setTransitionDuration}
        />
      ),
    },
  };

  const config = prototypeConfig[prototypeId as keyof typeof prototypeConfig];

  if (!config) {
    return (
      <div className="glass-surface p-8 text-center">
        <p className="text-neutral-600 dark:text-neutral-400">
          Prototype not found
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Control Buttons */}
      <div className="flex justify-center">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handlePlayPause}
            variant="primary"
            size="default"
            className={`w-full sm:w-auto ${!isPlaying ? 'animate-subtle-pulse-gentle' : ''}`}
          >
            {isPlaying
              ? "Pause"
              : text.length >= sourceText.length
                ? "Restart"
                : "Play"}
          </Button>
          <Button
            onClick={handleRestart}
            variant="secondary"
            size="default"
            className="w-full sm:w-auto"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Visual Display */}
      <div className="glass-surface p-6 sm:p-8 md:p-10 lg:p-12 h-[180px] sm:h-[200px] md:h-[220px] overflow-y-auto overscroll-contain">
        {config.component}
      </div>

      {/* Settings Controls */}
      <div className="flex flex-col gap-5 mt-8">
        <SharedControls
          text={sourceText}
          onTextChange={handleTextChange}
          streamMode={streamMode}
          onStreamModeChange={handleStreamModeChange}
          speed={speed}
          onSpeedChange={setSpeed}
          shouldLoop={shouldLoop}
          onLoopChange={setShouldLoop}
        />
        {config.specificControls}
      </div>
    </div>
  );
}


"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StreamMode } from "./prototypes/types";

interface SharedControlsProps {
  text: string;
  onTextChange: (text: string) => void;
  streamMode: StreamMode;
  onStreamModeChange: (mode: StreamMode) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  shouldLoop: boolean;
  onLoopChange: (shouldLoop: boolean) => void;
}

export function SharedControls({
  text,
  onTextChange,
  streamMode,
  onStreamModeChange,
  speed,
  onSpeedChange,
  shouldLoop,
  onLoopChange,
}: SharedControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Text Input */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="text-input"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Text to Animate
        </label>
        <textarea
          id="text-input"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="glass-input w-full p-3 text-sm text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-nebula/50 resize-none bg-neutral-50 dark:bg-neutral-900 overscroll-contain"
          rows={4}
          placeholder="Enter text to animate..."
        />
      </div>

      {/* Stream Mode Selector */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="stream-mode"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Stream Mode
        </label>
        <Select value={streamMode} onValueChange={onStreamModeChange}>
          <SelectTrigger className="glass-input w-full bg-neutral-50 dark:bg-neutral-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-50 dark:bg-neutral-900">
            <SelectItem value="character">Character</SelectItem>
            <SelectItem value="word">Word</SelectItem>
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="sentence">Sentence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Speed Slider */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="speed-slider"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Speed: {speed}ms per{" "}
          {streamMode === "character" ? "character" : streamMode}
        </label>
        <input
          id="speed-slider"
          type="range"
          min="15"
          max="500"
          step="5"
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
        />
        <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span>15ms (fast)</span>
          <span>500ms (slow)</span>
        </div>
      </div>

      {/* Loop Toggle */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="loop-toggle"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
        >
          Loop animation
        </label>
        <Switch
          id="loop-toggle"
          checked={shouldLoop}
          onCheckedChange={onLoopChange}
        />
      </div>
    </div>
  );
}


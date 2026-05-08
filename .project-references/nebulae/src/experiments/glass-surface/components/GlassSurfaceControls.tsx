"use client";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GlassSurfaceControlsProps {
  blur: number;
  onBlurChange: (blur: number) => void;
  backgroundOpacity: number;
  onBackgroundOpacityChange: (opacity: number) => void;
  border: boolean;
  onBorderChange: (border: boolean) => void;
  borderOpacity: number;
  onBorderOpacityChange: (opacity: number) => void;
  shadowIntensity: number;
  onShadowIntensityChange: (intensity: number) => void;
  borderRadius: string;
  onBorderRadiusChange: (radius: string) => void;
  interactive: boolean;
  onInteractiveChange: (interactive: boolean) => void;
  onReset: () => void;
}

const borderRadiusOptions = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "2xl", label: "Extra Large" },
];

export function GlassSurfaceControls({
  blur,
  onBlurChange,
  backgroundOpacity,
  onBackgroundOpacityChange,
  border,
  onBorderChange,
  borderOpacity,
  onBorderOpacityChange,
  shadowIntensity,
  onShadowIntensityChange,
  borderRadius,
  onBorderRadiusChange,
  interactive,
  onInteractiveChange,
  onReset,
}: GlassSurfaceControlsProps) {
  const handleCopyToClipboard = () => {
    const config = {
      blur,
      backgroundOpacity,
      border,
      borderOpacity,
      shadowIntensity,
      borderRadius,
      interactive,
    };
    const configString = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(configString);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Blur Slider */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="blur-slider"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Backdrop Blur: {blur}px
        </label>
        <input
          id="blur-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={blur}
          onChange={(e) => onBlurChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
        />
        <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span>0px (none)</span>
          <span>100px (max)</span>
        </div>
      </div>

      {/* Background Opacity Slider */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="background-opacity-slider"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Background Opacity: {backgroundOpacity}%
        </label>
        <input
          id="background-opacity-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={backgroundOpacity}
          onChange={(e) => onBackgroundOpacityChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
        />
        <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span>0% (transparent)</span>
          <span>100% (opaque)</span>
        </div>
      </div>

      {/* Border Toggle */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="border-toggle"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
        >
          Show Border
        </label>
        <Switch
          id="border-toggle"
          checked={border}
          onCheckedChange={onBorderChange}
        />
      </div>

      {/* Border Opacity Slider */}
      {border && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="border-opacity-slider"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Border Opacity: {borderOpacity}%
          </label>
          <input
            id="border-opacity-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={borderOpacity}
            onChange={(e) => onBorderOpacityChange(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
          />
          <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
            <span>0% (transparent)</span>
            <span>100% (opaque)</span>
          </div>
        </div>
      )}

      {/* Shadow Intensity Slider */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="shadow-intensity-slider"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Shadow Intensity: {shadowIntensity}%
        </label>
        <input
          id="shadow-intensity-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={shadowIntensity}
          onChange={(e) => onShadowIntensityChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
        />
        <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span>0% (none)</span>
          <span>100% (max)</span>
        </div>
      </div>

      {/* Border Radius Select */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="border-radius-select"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Border Radius
        </label>
        <Select value={borderRadius} onValueChange={onBorderRadiusChange}>
          <SelectTrigger className="glass-input w-full bg-neutral-50 dark:bg-neutral-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-50 dark:bg-neutral-900">
            {borderRadiusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Interactive Toggle */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="interactive-toggle"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
        >
          Interactive (hover effects)
        </label>
        <Switch
          id="interactive-toggle"
          checked={interactive}
          onCheckedChange={onInteractiveChange}
        />
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex gap-3">
        <Button
          onClick={handleCopyToClipboard}
          variant="primary"
          size="default"
          className="flex-1"
        >
          Copy Settings to Clipboard
        </Button>
        <Button
          onClick={onReset}
          variant="destructive"
          size="default"
          className="flex-1"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}


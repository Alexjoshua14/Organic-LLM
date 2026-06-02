"use client";

interface RippleControlsProps {
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  transitionDuration: number;
  onTransitionDurationChange: (duration: number) => void;
}

const presetColors = [
  { name: "Ember", value: "var(--color-accent-ember)" },
  { name: "Nebula", value: "var(--color-accent-nebula)" },
  { name: "Aurora", value: "var(--color-accent-aurora)" },
  { name: "Plasma", value: "var(--color-accent-plasma)" },
];

export function RippleControls({
  highlightColor,
  onHighlightColorChange,
  transitionDuration,
  onTransitionDurationChange,
}: RippleControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Highlight Color
        </label>
        <div className="flex flex-wrap gap-2">
          {presetColors.map((color) => (
            <button
              key={color.value}
              onClick={() => onHighlightColorChange(color.value)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                highlightColor === color.value
                  ? "bg-neutral-900 dark:bg-neutral-50 text-neutral-50 dark:text-neutral-900"
                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
              }`}
            >
              {color.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="transition-duration"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Transition Duration: {transitionDuration}ms
        </label>
        <input
          id="transition-duration"
          type="range"
          min="50"
          max="500"
          step="10"
          value={transitionDuration}
          onChange={(e) => onTransitionDurationChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
        />
        <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span>50ms (fast)</span>
          <span>500ms (slow)</span>
        </div>
      </div>
    </div>
  );
}


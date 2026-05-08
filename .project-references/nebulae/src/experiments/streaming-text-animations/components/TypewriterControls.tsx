"use client";

import { Switch } from "@/components/ui/switch";

interface TypewriterControlsProps {
  showCursor: boolean;
  onShowCursorChange: (show: boolean) => void;
}

export function TypewriterControls({
  showCursor,
  onShowCursorChange,
}: TypewriterControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="show-cursor"
        className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
      >
        Show cursor
      </label>
      <Switch
        id="show-cursor"
        checked={showCursor}
        onCheckedChange={onShowCursorChange}
      />
    </div>
  );
}


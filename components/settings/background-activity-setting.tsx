"use client";

import { BACKGROUND_ACTIVITY_OPTIONS, BackgroundActivityModeSchema } from "@/lib/background-activity";
import { useBackgroundActivityMode } from "@/hooks/use-background-probe";
import { setSettings } from "@/lib/user-settings";

export function BackgroundActivitySetting() {
  const mode = useBackgroundActivityMode();

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground" htmlFor="background-activity">
          Background activity
        </label>
        <p className="text-sm text-muted-foreground" id="background-activity-description">
          Pauses probes when this tab is hidden, you’re idle, or low power is detected.
        </p>
      </div>
      <select
        aria-describedby="background-activity-description background-activity-cadence"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:max-w-xs"
        id="background-activity"
        value={mode}
        onChange={(event) => {
          const parsed = BackgroundActivityModeSchema.safeParse(event.target.value);

          if (parsed.success) setSettings({ backgroundActivity: parsed.data });
        }}
      >
        {BACKGROUND_ACTIVITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground" id="background-activity-cadence">
        {BACKGROUND_ACTIVITY_OPTIONS.find((option) => option.value === mode)?.description}
        {" "}Checks run while an agent thread is open. Notable updates prompt an automatic reply.
      </p>
      <p className="text-xs font-light text-muted-foreground">
        Screen lock and low power signals depend on your browser. Cost / battery saver lets you
        reduce activity manually on any device.
      </p>
    </section>
  );
}

"use client";

import type { SpeakModalities } from "@/lib/schemas/speak-modalities";

import { Popover } from "radix-ui";
import { Lock, RotateCcw, SlidersHorizontal } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { Switch } from "@/components/design-system/switch";
import { cn } from "@/lib/utils";

const MODALITY_ROWS: Array<{ key: keyof SpeakModalities; label: string; hint: string }> = [
  { key: "text", label: "Captions", hint: "Live captions and the transcript" },
  { key: "genUi", label: "Cards", hint: "Plans, lists and cards beside the call" },
  { key: "web", label: "Web pages", hint: "Show a page when Organic opens one" },
];

/**
 * Everything that configures a call, behind one control. These are set before a call and
 * locked during it, because the Realtime session is minted with them.
 */
export function SpeakSettingsMenu({
  modalities,
  onModalitiesChange,
  memoryEnabled,
  onMemoryEnabledChange,
  locked,
  onReset,
}: {
  modalities: SpeakModalities;
  onModalitiesChange: (next: SpeakModalities) => void;
  memoryEnabled: boolean;
  onMemoryEnabledChange: (next: boolean) => void;
  locked: boolean;
  onReset: () => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label="Call settings"
          className={cn(
            glass({ border: "all" }),
            "flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          title="Call settings"
          type="button"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          className={cn(
            glass({ opaque: true, border: "all" }),
            "z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-inset-md shadow-xl outline-none"
          )}
          collisionPadding={16}
          sideOffset={8}
        >
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Show during the call
          </p>
          <div className="mt-stack-xs flex flex-col">
            {MODALITY_ROWS.map((row) => (
              <SettingRow
                key={row.key}
                disabled={locked}
                hint={row.hint}
                label={row.label}
                selected={modalities[row.key]}
                onChange={(next) => onModalitiesChange({ ...modalities, [row.key]: next })}
              />
            ))}
          </div>

          <div className="my-stack-sm h-px bg-border/50" />

          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Privacy
          </p>
          <div className="mt-stack-xs">
            <SettingRow
              disabled={locked}
              hint={
                memoryEnabled
                  ? "Organic can recall what it knows about you and learn from this call"
                  : "Organic won't search or add to your memories"
              }
              label="Memory"
              selected={memoryEnabled}
              onChange={onMemoryEnabledChange}
            />
          </div>

          {locked ? (
            <p className="mt-stack-sm flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Lock aria-hidden className="size-3" />
              End the call to change these.
            </p>
          ) : null}

          <div className="my-stack-sm h-px bg-border/50" />

          <Popover.Close asChild>
            <button
              className="flex min-h-11 w-full items-center gap-inline-sm rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              type="button"
              onClick={onReset}
            >
              <RotateCcw aria-hidden className="size-4" />
              Reset voice session
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SettingRow({
  label,
  hint,
  selected,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  selected: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-inline-md">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-2xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Switch
        aria-label={label}
        isDisabled={disabled}
        isSelected={selected}
        onValueChange={onChange}
      />
    </div>
  );
}

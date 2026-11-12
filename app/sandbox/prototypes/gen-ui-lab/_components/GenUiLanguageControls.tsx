"use client";

import type { GenUiLanguageRotation } from "../_hooks/use-gen-ui-language-rotation";

import { ChevronDown, Pause, Play } from "lucide-react";

import { TOOLBAR_CONTROL } from "./GenUiArrangementToolbar";

import { glass } from "@/components/design-system/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";

export type GenUiLanguageOption = { id: string; label: string };

type GenUiLanguageControlsProps = {
  rotation: GenUiLanguageRotation;
  languages: ReadonlyArray<GenUiLanguageOption>;
  /** Pages with their own default content list it first; null selects it. */
  defaultLabel?: string;
};

/**
 * A language picker and a shuffle toggle. Shuffle visits every language once per round in random
 * order. Keyboard focus inverts the control (background + text), never a ring.
 */
export function GenUiLanguageControls({
  rotation,
  languages,
  defaultLabel,
}: GenUiLanguageControlsProps) {
  const { language, auto, reducedMotion, select, toggleAuto } = rotation;
  const current = language
    ? (languages.find((option) => option.id === language)?.label ?? language)
    : (defaultLabel ?? "Choose");
  const shuffling = auto && !reducedMotion;

  return (
    <div
      className="flex flex-wrap items-center gap-x-inline-sm gap-y-stack-xs"
      role="group"
      aria-label="Language"
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Language: ${current}`}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md border border-border/60 px-inset-md text-sm pointer-coarse:min-h-11 ${TOOLBAR_CONTROL}`}
          >
            <span className="text-muted-foreground">Language</span>
            <span className="font-medium text-foreground">{current}</span>
            <ChevronDown aria-hidden className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          collisionPadding={12}
          sideOffset={6}
          className={`${glass({ opaque: true })} max-h-[min(24rem,60vh)] min-w-48 overflow-y-auto`}
        >
          <DropdownMenuRadioGroup
            value={language ?? ""}
            onValueChange={(value) => {
              select(value === "" ? null : value);
            }}
          >
            {defaultLabel ? (
              <DropdownMenuRadioItem value="" textValue={defaultLabel}>
                {defaultLabel}
              </DropdownMenuRadioItem>
            ) : null}
            {languages.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={option.id} textValue={option.label}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        aria-pressed={shuffling}
        disabled={reducedMotion}
        title={
          reducedMotion
            ? "Shuffle is off with reduced motion"
            : `Shuffle through all ${languages.length} languages, each once per round; pauses while you interact`
        }
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs disabled:opacity-50 pointer-coarse:min-h-11 ${TOOLBAR_CONTROL}`}
        onClick={() => {
          toggleAuto();
        }}
      >
        {shuffling ? (
          <Pause aria-hidden className="size-3.5" />
        ) : (
          <Play aria-hidden className="size-3.5" />
        )}{" "}
        Shuffle
      </button>
      <span className="text-xs text-muted-foreground">{languages.length} languages</span>
    </div>
  );
}

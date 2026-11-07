"use client";

import type { ReactNode } from "react";
import type { FooterPlacementMap } from "./footer/footer-placement";
import type { SteerAction } from "./footer/steer-action";

import { useRef } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Popover } from "radix-ui";

import { ComposerActionButton } from "../composer-action-button";

import { ComposerAddFilesButton } from "./controls/add-files-button";
import { ComposerContextEffortSlider } from "./controls/context-effort-slider";
import { ComposerModelEffortSelect } from "./controls/model-effort-select";
import { ComposerPreviewChip } from "./controls/preview-chip";
import { ComposerSpeechChip } from "./controls/speech-chip";
import { ComposerSteerButton } from "./controls/steer-button";
import { ComposerToolToggleGroup } from "./controls/tool-toggle-group";

import { ThreadClipboardPicker } from "@/components/chat/thread-reference/thread-clipboard-picker";
import { glass } from "@/components/design-system/primitives";
import { ComposerPersonaChip } from "@/components/personas/persona-chip";
import { cn } from "@/lib/utils";

function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="core-input-options-setting">
      <span>{label}</span>
      {children}
    </div>
  );
}

/** One options surface for compact CoreInput, including Stage and narrow chat composers. */
export function CoreInputOptions({
  placement,
  ready = true,
  locked = false,
  steer,
  onThreadReference,
  contextBudget,
}: {
  placement: FooterPlacementMap;
  ready?: boolean;
  locked?: boolean;
  steer?: SteerAction | null;
  onThreadReference?: (id: string) => void;
  contextBudget?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const available = (id: keyof FooterPlacementMap) => placement[id] !== "hidden";

  return (
    <Popover.Root>
      <ComposerActionButton
        wrapTrigger={Popover.Trigger}
        aria-label="Composer options"
        className="size-9 min-w-9 p-0"
        disabled={!ready}
        title="Model, tools, and composer settings"
      >
        <SlidersHorizontal aria-hidden size={16} />
      </ComposerActionButton>
      <Popover.Portal>
        <Popover.Content
          ref={panelRef}
          aria-label="Composer settings"
          align="start"
          side="top"
          sideOffset={8}
          collisionPadding={16}
          className={cn(glass({ opaque: true }), "core-input-options-panel")}
          onOpenAutoFocus={(event) => {
            // Opening settings should not immediately open a caption or a nested picker.
            event.preventDefault();
            panelRef.current?.focus();
          }}
          tabIndex={-1}
        >
          <div className="core-input-options-heading">
            <span>Composer settings</span>
            <Popover.Close
              aria-label="Close composer settings"
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted/25 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X aria-hidden size={16} />
            </Popover.Close>
          </div>
          {available("modelEffort") ? (
            <OptionRow label="Model & effort">
              <ComposerModelEffortSelect />
            </OptionRow>
          ) : null}
          {available("persona") ? (
            <OptionRow label="Persona">
              <ComposerPersonaChip />
            </OptionRow>
          ) : null}
          {available("toolToggles") ? (
            <OptionRow label="Search & memory">
              <ComposerToolToggleGroup />
            </OptionRow>
          ) : null}
          {available("contextEffort") ? (
            <OptionRow label="Context effort">
              <ComposerContextEffortSlider />
            </OptionRow>
          ) : null}
          {available("speech") ? (
            <OptionRow label="Read-aloud style">
              <ComposerSpeechChip />
            </OptionRow>
          ) : null}
          {available("preview") ? (
            <OptionRow label="Markdown preview">
              <ComposerPreviewChip />
            </OptionRow>
          ) : null}
          {available("addFiles") ? (
            <OptionRow label="Photos & files">
              <ComposerAddFilesButton />
            </OptionRow>
          ) : null}
          {available("threadClipboard") && onThreadReference ? (
            <OptionRow label="Reference a conversation">
              <ThreadClipboardPicker onSelect={onThreadReference} />
            </OptionRow>
          ) : null}
          {available("steer") && steer ? (
            <OptionRow label={steer.label}>
              <ComposerSteerButton locked={locked} steer={steer} />
            </OptionRow>
          ) : null}
          {contextBudget ? <OptionRow label="Context usage">{contextBudget}</OptionRow> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

"use client";

import type { ReactNode } from "react";
import type { FooterPlacementMap } from "./footer/footer-placement";

import { useRef, useState } from "react";
import { Popover } from "radix-ui";

import { ComposerActionButton } from "../composer-action-button";

import { ComposerContextEffortSlider } from "./controls/context-effort-slider";
import { ComposerModelEffortSelect } from "./controls/model-effort-select";
import { ComposerPreviewChip } from "./controls/preview-chip";
import { ComposerToolToggleGroup } from "./controls/tool-toggle-group";
import { ComposerOptionsIcon } from "./options-icon";

import { homeComposerGlassSurface } from "@/components/design-system/primitives";
import { ComposerPersonaChip } from "@/components/personas/persona-chip";
import { cn } from "@/lib/utils";

/** One options surface for compact CoreInput, including Stage and narrow chat composers. */
export function CoreInputOptions({
  placement,
  ready = true,
  contextBudget,
}: {
  placement: FooterPlacementMap;
  ready?: boolean;
  contextBudget?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const available = (id: keyof FooterPlacementMap) => placement[id] !== "hidden";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <ComposerActionButton
        wrapTrigger={Popover.Trigger}
        aria-label="Composer options"
        className="size-9 min-w-9 p-0"
        disabled={!ready}
        title="Model, tools, and composer settings"
      >
        <ComposerOptionsIcon open={open} />
      </ComposerActionButton>
      <Popover.Portal>
        <Popover.Content
          ref={panelRef}
          aria-label="Composer settings"
          align="start"
          side="top"
          sideOffset={8}
          collisionPadding={16}
          className={cn(homeComposerGlassSurface, "core-input-options-panel")}
          onOpenAutoFocus={(event) => {
            // Opening settings should not immediately open a caption or a nested picker.
            event.preventDefault();
            panelRef.current?.focus();
          }}
          tabIndex={-1}
        >
          {available("modelEffort") || contextBudget ? (
            <div className="core-input-options-model-row">
              {available("modelEffort") ? <ComposerModelEffortSelect /> : null}
              {contextBudget ? (
                <div className="core-input-options-budget">{contextBudget}</div>
              ) : null}
            </div>
          ) : null}
          {available("contextEffort") ||
          available("persona") ||
          available("toolToggles") ||
          available("preview") ? (
            <div className="core-input-options-toggle-row">
              {available("contextEffort") ? <ComposerContextEffortSlider /> : null}
              <div className="core-input-options-toggles">
                {available("persona") ? <ComposerPersonaChip /> : null}
                {available("toolToggles") ? <ComposerToolToggleGroup /> : null}
                {available("preview") ? <ComposerPreviewChip /> : null}
              </div>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

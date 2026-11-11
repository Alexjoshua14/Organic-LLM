"use client";

import type { ReactNode } from "react";
import type { FooterPlacementMap } from "./footer/footer-placement";
import type { SteerAction } from "./footer/steer-action";

import { useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";

import { ComposerActionButton } from "../composer-action-button";

import { ComposerContextEffortSlider } from "./controls/context-effort-slider";
import { ComposerModelEffortSelect } from "./controls/model-effort-select";
import { ComposerPreviewChip } from "./controls/preview-chip";
import { ComposerSteerButton } from "./controls/steer-button";
import { ComposerToolToggleGroup } from "./controls/tool-toggle-group";

import { glass } from "@/components/design-system/primitives";
import { ComposerPersonaChip } from "@/components/personas/persona-chip";
import { cn } from "@/lib/utils";

/** One options surface for compact CoreInput, including Stage and narrow chat composers. */
export function CoreInputOptions({
  placement,
  ready = true,
  locked = false,
  steer,
  contextBudget,
}: {
  placement: FooterPlacementMap;
  ready?: boolean;
  locked?: boolean;
  steer?: SteerAction | null;
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
          {contextBudget ? (
            <div className="core-input-options-budget-row">{contextBudget}</div>
          ) : null}
          {available("modelEffort") || available("contextEffort") ? (
            <div className="core-input-options-model-row">
              {available("modelEffort") ? <ComposerModelEffortSelect /> : null}
              {available("contextEffort") ? <ComposerContextEffortSlider /> : null}
            </div>
          ) : null}
          {available("persona") ||
          available("toolToggles") ||
          available("preview") ||
          (available("steer") && steer) ? (
            <div className="core-input-options-toggle-row">
              {available("persona") ? <ComposerPersonaChip /> : null}
              {available("toolToggles") ? <ComposerToolToggleGroup /> : null}
              {available("preview") ? <ComposerPreviewChip /> : null}
              {available("steer") && steer ? (
                <ComposerSteerButton locked={locked} steer={steer} showLabel />
              ) : null}
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

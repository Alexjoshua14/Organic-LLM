"use client";

import type { ReactNode } from "react";
import type { FooterPlacementMap } from "./footer/footer-placement";

import { useCallback, useMemo, useRef, useState } from "react";
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

/**
 * How far the panel tucks under the top of the shell: half of the compact row's 8px padding
 * (`--spacing-inset-sm`), which is `--spacing-stack-xs`. Keep it below that padding so the
 * overlap only ever covers empty shell, never a control or the text.
 */
const OPTIONS_PANEL_OVERLAP_PX = 4;

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
  const [align, setAlign] = useState<"start" | "center">("start");
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const available = (id: keyof FooterPlacementMap) => placement[id] !== "hidden";

  // Layout-neutral marker used to find the prompt shell (the panel's anchor) and the CoreInput
  // panel slot (the portal container, which keeps the panel in the shell's stacking context and
  // just before it in paint order).
  const hostRef = useCallback((el: HTMLElement | null) => {
    setShell(el?.closest<HTMLElement>("[data-prompt-input-shell]") ?? null);
    setRoot(
      el
        ?.closest<HTMLElement>("[data-core-input-root]")
        ?.querySelector<HTMLElement>("[data-core-input-panel-slot]") ?? null
    );
  }, []);
  const anchorRef = useMemo(() => ({ current: shell }), [shell]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // On xs screens (below Tailwind's sm breakpoint) the panel is about as wide as the
        // composer, so it centres over it instead of hugging the left edge.
        if (next) setAlign(isExtraSmallScreen() ? "center" : "start");
        setOpen(next);
      }}
    >
      <span ref={hostRef} className="contents" />
      {shell ? <Popover.Anchor virtualRef={anchorRef} /> : null}
      <ComposerActionButton
        wrapTrigger={Popover.Trigger}
        aria-label="Composer options"
        className="size-9 min-w-9 p-0"
        disabled={!ready}
        title="Model, tools, and composer settings"
      >
        <ComposerOptionsIcon open={open} />
      </ComposerActionButton>
      <Popover.Portal container={root}>
        <Popover.Content
          ref={panelRef}
          aria-label="Composer settings"
          align={align}
          side="top"
          sideOffset={-OPTIONS_PANEL_OVERLAP_PX}
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

/** Below Tailwind's `sm` breakpoint (`--breakpoint-sm`, 40rem by default). */
function isExtraSmallScreen() {
  const sm =
    getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-sm").trim() ||
    "40rem";

  return window.matchMedia(`(width < ${sm})`).matches;
}

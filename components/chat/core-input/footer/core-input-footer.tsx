"use client";

import type { ReactNode, RefObject } from "react";
import type { FeatureHintId } from "@/lib/onboarding/feature-hints";
import type { FooterPlacementMap } from "./footer-placement";
import type { SteerAction } from "./steer-action";

import { useCoreInputControls } from "../core-input-context";
import { ComposerAddFilesButton } from "../controls/add-files-button";
import { ComposerContextEffortSlider } from "../controls/context-effort-slider";
import { ComposerMicButton } from "../controls/mic-button";
import { ComposerModelEffortSelect } from "../controls/model-effort-select";
import { ComposerOverflowMenu } from "../controls/overflow-menu";
import { ComposerPreviewChip } from "../controls/preview-chip";
import { ComposerSpeechChip } from "../controls/speech-chip";
import { ComposerSteerButton } from "../controls/steer-button";
import { ComposerToolToggleGroup } from "../controls/tool-toggle-group";

import { hasOverflowItems } from "./footer-placement";

import { ThreadClipboardPicker } from "@/components/chat/thread-reference/thread-clipboard-picker";
import { FeatureHint } from "@/components/onboarding/feature-hint";
import { ComposerPersonaChip } from "@/components/personas/persona-chip";
import {
  PromptInputFooter,
  PromptInputTools,
} from "@/components/third-party/ai-elements/prompt-input";

export type CoreInputFooterProps = {
  /** Where each control renders. Build it with `resolveFooterPlacement`. */
  placement: FooterPlacementMap;
  /**
   * First-run coachmarks anchored to the tool toggles, model picker, and steer button. CoreInput
   * turns them off on a condensed footer, where those anchors move or shrink.
   */
  showFeatureHints?: boolean;
  /** Holds the steer coachmark until Noesis assist is available. */
  steerHintShowWhen?: boolean;
  /**
   * Attached to the tools row. `useCoreInputLayout` measures the prompt shell from here, so it
   * must stay inside `PromptInput`.
   */
  toolsRef?: RefObject<HTMLDivElement | null>;
  /** Required when `placement.steer` is not `"hidden"`. */
  steer?: SteerAction | null;
  /** Composer disabled or showing the sent shimmer; see `ComposerSteerButton`. */
  locked?: boolean;
  /** The textarea dictation writes into. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onDictation?: (text: string) => void;
  /** A thread picked from the thread clipboard. */
  onThreadReference?: (id: string) => void;
  /** The send control (CoreInput builds it; its look depends on persona and submit variant). */
  submit: ReactNode;
};

/** Wraps a control in its first-run coachmark anchor when hints are on. */
function hinted(show: boolean, id: FeatureHintId, node: ReactNode, showWhen?: boolean) {
  return show ? (
    <FeatureHint id={id} showWhen={showWhen}>
      {node}
    </FeatureHint>
  ) : (
    node
  );
}

/**
 * CoreInput's footer row. Layout only: it renders each control where `placement` says and owns
 * no state. Toggle state comes from `CoreInputControlsContext`; actions that need CoreInput's
 * internals (steer, dictation, thread references, send) arrive as props.
 *
 * Regions, left to right:
 *
 * - leading: persona, search + memory, speech, preview, model + effort, context effort
 * - trailing: add files, thread clipboard, mic, overflow menu
 * - submit: steer, send
 *
 * Leading and trailing share the tools row (`toolsRef`); the submit cluster sits beside it.
 *
 * The CoreInput lab's "Assembled toolbar" card renders this same component, so a layout change
 * here shows up in `/sandbox/prototypes/core-input?view=focus&control=toolbar` as well.
 */
export function CoreInputFooter({
  placement,
  showFeatureHints = false,
  steerHintShowWhen = true,
  toolsRef,
  steer,
  locked = false,
  textareaRef,
  onDictation,
  onThreadReference,
  submit,
}: CoreInputFooterProps) {
  const { showLabels } = useCoreInputControls();
  const inline = (id: keyof FooterPlacementMap) => placement[id] === "inline";

  return (
    <PromptInputFooter className="cursor-default overflow-visible">
      <div ref={toolsRef} className="min-w-0 flex-1 overflow-visible">
        <PromptInputTools className="flex min-w-0 w-full items-center justify-between gap-1 overflow-visible">
          {/* Leading: settings for the next turn. `gap-3` separates control groups; the
              tighter `gap-1` inside each group is owned by the group itself. */}
          <div className="flex min-w-0 items-center gap-3 overflow-visible">
            {inline("persona") ? <ComposerPersonaChip showLabel={showLabels} /> : null}
            {inline("toolToggles")
              ? hinted(showFeatureHints, "composer-search-memory", <ComposerToolToggleGroup />)
              : null}
            {inline("speech") ? <ComposerSpeechChip /> : null}
            {inline("preview") ? <ComposerPreviewChip /> : null}
            {inline("modelEffort")
              ? hinted(showFeatureHints, "composer-auto-model", <ComposerModelEffortSelect />)
              : null}
            {inline("contextEffort") ? <ComposerContextEffortSlider /> : null}
          </div>

          {/* Trailing: things added to the draft, then the overflow menu. */}
          <div className="flex shrink-0 items-center gap-1">
            {inline("addFiles") ? <ComposerAddFilesButton /> : null}
            {inline("threadClipboard") && onThreadReference ? (
              <ThreadClipboardPicker onSelect={onThreadReference} />
            ) : null}
            {inline("mic") ? (
              <ComposerMicButton textareaRef={textareaRef} onTranscriptionChange={onDictation} />
            ) : null}
            {/* Mounted only while it has items, so its open state resets when the footer
                widens past the condensed breakpoint mid-open. */}
            {hasOverflowItems(placement) ? (
              <ComposerOverflowMenu placement={placement} steer={steer} />
            ) : null}
          </div>
        </PromptInputTools>
      </div>

      {/* Submit cluster: beside the tools row, so it keeps its size however the tools truncate. */}
      <div className="flex shrink-0 items-center gap-1.5">
        {inline("steer") && steer
          ? hinted(
              showFeatureHints,
              "noesis-steer-assist",
              <ComposerSteerButton locked={locked} steer={steer} />,
              steerHintShowWhen
            )
          : null}
        {submit}
      </div>
    </PromptInputFooter>
  );
}

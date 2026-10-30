"use client";

import type { ReactNode } from "react";

import { SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";

import { ComposerModelEffortSelect } from "./controls/model-effort-select";
import { ComposerToolToggleGroup } from "./controls/tool-toggle-group";
import { ComposerSpeechChip } from "./controls/speech-chip";

/** Stage's beta keeps CoreInput's real controls one click away from the draft. */
export function StageBetaOptions({ threadPicker }: { threadPicker: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label="Composer options"
          className="stage-beta-options-trigger"
          title="Model, effort, search, memory, and references"
          type="button"
        >
          <SlidersHorizontal aria-hidden size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Stage composer options"
          align="start"
          side="top"
          sideOffset={12}
          className="stage-beta-options-panel"
        >
          <div className="stage-beta-options-heading">
            <span>Composer</span>
            <span>Stage beta</span>
          </div>
          <div className="stage-beta-options-setting">
            <span>Model & effort</span>
            <ComposerModelEffortSelect />
          </div>
          <div className="stage-beta-options-setting">
            <span>Tools</span>
            <ComposerToolToggleGroup />
          </div>
          <div className="stage-beta-options-setting">
            <span>Read-aloud style</span>
            <ComposerSpeechChip />
          </div>
          <div className="stage-beta-options-setting">
            <span>Reference a conversation</span>
            {threadPicker}
          </div>
          <p>Enter to send · Shift + Enter for a new line</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

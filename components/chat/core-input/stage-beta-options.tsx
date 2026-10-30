"use client";

import type { ReactNode } from "react";

import { SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";

import { ComposerActionButton } from "../composer-action-button";

import { ComposerModelEffortSelect } from "./controls/model-effort-select";
import { ComposerToolToggleGroup } from "./controls/tool-toggle-group";
import { ComposerSpeechChip } from "./controls/speech-chip";

/** Stage's beta keeps CoreInput's real controls one click away from the draft. */
export function StageBetaOptions({ threadPicker }: { threadPicker: ReactNode }) {
  return (
    <Popover.Root>
      <ComposerActionButton
        wrapTrigger={Popover.Trigger}
        aria-label="Composer options"
        className="size-9 min-w-9 p-0"
        title="Model, effort, search, memory, and references"
      >
        <SlidersHorizontal aria-hidden size={16} />
      </ComposerActionButton>
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

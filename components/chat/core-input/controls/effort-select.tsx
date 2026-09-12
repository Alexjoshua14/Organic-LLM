"use client";

import { useCoreInputControls } from "../core-input-context";

import { composerSelectSegmentClasses } from "./select-segment";

import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from "@/components/third-party/ai-elements/prompt-input";
import {
  getChatEffortLabel,
  getEffortLevelsForModel,
  modelSupportsEffortControl,
} from "@/lib/schemas/chat-effort";
import { cn } from "@/lib/utils";

export function ComposerEffortSelect() {
  const { model, effort, onEffortChange, useCondensedLayout } = useCoreInputControls();
  const effortLevels = getEffortLevelsForModel(model.id);
  const effortSelectable = modelSupportsEffortControl(model.id);

  return (
    <PromptInputSelect
      required
      disabled={!effortSelectable}
      defaultValue={effort}
      value={effort}
      onValueChange={onEffortChange}
    >
      <PromptInputSelectTrigger
        aria-label={
          effortSelectable ? "Reasoning effort" : "Reasoning effort unavailable for this model"
        }
        className={cn(
          composerSelectSegmentClasses,
          "rounded-l-none rounded-r-md",
          // The wrapper owns the fade-out; without this the base
          // `disabled:opacity-50` would snap to half-opacity before it starts.
          "disabled:opacity-100",
          useCondensedLayout ? "max-w-19" : "max-w-24 sm:max-w-28"
        )}
        size="sm"
        title={
          effortSelectable
            ? "Reasoning effort"
            : "This model does not expose a reasoning effort control"
        }
      >
        <PromptInputSelectValue className="truncate min-w-0">
          {getChatEffortLabel(effort)}
        </PromptInputSelectValue>
      </PromptInputSelectTrigger>
      <PromptInputSelectContent className="max-h-80 overflow-y-auto" defaultValue={effort}>
        {effortLevels.map((row) => (
          <PromptInputSelectItem key={row.id} textValue={row.name} value={row.id}>
            {row.name}
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  );
}

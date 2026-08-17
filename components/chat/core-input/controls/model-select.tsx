"use client";

import { useCoreInputControls } from "../core-input-context";

import { composerSelectSegmentClasses } from "./select-segment";

import { ModelZdrIndicator } from "@/components/chat/model-zdr-indicator";
import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

export function ComposerModelSelect() {
  const { model, selectableModels, onModelChange, useCondensedLayout } = useCoreInputControls();

  return (
    <PromptInputSelect
      required
      defaultValue={model.id}
      value={model.id}
      onValueChange={onModelChange}
    >
      <PromptInputSelectTrigger
        aria-label="Model"
        className={cn(
          composerSelectSegmentClasses,
          // Reclaims the right corners once effort slides away, so the hover
          // fill stops squaring off against the frame's rounded edge.
          "rounded-l-md rounded-r-none group-data-[effort=hidden]/segments:rounded-r-md",
          useCondensedLayout ? "max-w-30" : "max-w-32 sm:max-w-48"
        )}
        size="sm"
        title="Model"
      >
        <PromptInputSelectValue className="truncate min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{model.name}</span>
            {model.supportsZeroDataRetention && <ModelZdrIndicator />}
          </span>
        </PromptInputSelectValue>
      </PromptInputSelectTrigger>
      <PromptInputSelectContent className="max-h-80 overflow-y-auto" defaultValue={model.id}>
        {selectableModels.map((m) => (
          <PromptInputSelectItem key={m.id} textValue={m.name} value={m.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{m.name}</span>
              {m.supportsZeroDataRetention && <ModelZdrIndicator />}
            </span>
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  );
}

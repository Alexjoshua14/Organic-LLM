"use client";

import { useCoreInputControls } from "../core-input-context";

import { composerSelectSegmentClasses } from "./select-segment";

import { AutoModelLumenPill } from "@/components/chat/auto-model-lumen-pill";
import { ModelZdrIndicator } from "@/components/chat/model-zdr-indicator";
import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from "@/components/third-party/ai-elements/prompt-input";
import { formatCompactModelLabel, isAutoModelSelectorId } from "@/lib/llm/auto-model-router";
import { AUTO_RESOLVED_SONNET_MODEL_ID, models } from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";

export function ComposerModelSelect() {
  const { model, selectableModels, onModelChange, useCondensedLayout, autoModelPreview } =
    useCoreInputControls();

  const isAuto = isAutoModelSelectorId(model.id);
  const defaultAutoModel = models.anthropic.sonnet;
  const routedFullTitle = autoModelPreview?.decision.routedModelFullTitle ?? defaultAutoModel.name;
  const routedLabel =
    autoModelPreview?.decision.routedModelLabel ?? formatCompactModelLabel(defaultAutoModel.name);
  const routedId = autoModelPreview?.decision.routedModelId ?? AUTO_RESOLVED_SONNET_MODEL_ID;
  const activityState = autoModelPreview?.activityState ?? "idle";

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
          isAuto
            ? useCondensedLayout
              ? "max-w-48 pl-1 pr-1.5"
              : "max-w-56 sm:max-w-64 pl-1 pr-1.5"
            : useCondensedLayout
              ? "max-w-36"
              : "max-w-40 sm:max-w-56"
        )}
        data-model-id={isAuto ? "auto" : model.id}
        size="sm"
        title={isAuto ? `Model · Auto (${routedFullTitle})` : "Model"}
      >
        <PromptInputSelectValue className="truncate min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            {isAuto ? (
              <AutoModelLumenPill
                activityState={activityState}
                condensed={useCondensedLayout}
                domain={autoModelPreview?.decision.domain}
                reason={autoModelPreview?.decision.reason}
                routedModelFullTitle={routedFullTitle}
                routedModelId={routedId}
                routedModelLabel={routedLabel}
              />
            ) : (
              <span className="truncate">{model.name}</span>
            )}
            {model.supportsZeroDataRetention && <ModelZdrIndicator />}
          </span>
        </PromptInputSelectValue>
      </PromptInputSelectTrigger>
      <PromptInputSelectContent className="max-h-80 overflow-y-auto" defaultValue={model.id}>
        {selectableModels.map((m) => (
          <PromptInputSelectItem key={m.id} textValue={m.name} value={m.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{m.name}</span>
              {isAutoModelSelectorId(m.id) ? (
                <span className="text-[11px] font-normal text-current opacity-80">
                  ({routedLabel})
                </span>
              ) : null}
              {m.supportsZeroDataRetention && <ModelZdrIndicator />}
            </span>
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  );
}

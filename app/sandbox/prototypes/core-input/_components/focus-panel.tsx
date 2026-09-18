"use client";

import type { ChatStatus } from "ai";
import type { InputMarkdownMode } from "@/components/chat/core-input/core-input-context";
import type { ContextEffortLevel } from "@/lib/memory/context-effort";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { FocusLabState, LabPatch } from "../_lib/lab-state";
import type { SimulatedChat } from "../_lib/use-simulated-chat";

import { useMemo } from "react";

import { makeLabBudget } from "../_lib/lab-budget";

import {
  LabPanel,
  PanelButton,
  PanelNote,
  PanelSection,
  RangeRow,
  ReadoutRow,
  SegmentedRow,
  SelectRow,
  TextRow,
  ToggleRow,
  type SegmentedOption,
} from "./lab-panel";

import { formatTokenCount } from "@/lib/chat/context-budget";
import { CONTEXT_EFFORT_BUDGETS, CONTEXT_EFFORT_LEVELS } from "@/lib/memory/context-effort";
import { ChatModels, getSelectableChatModels } from "@/lib/schemas/chat";
import { getEffortLevelsForModel } from "@/lib/schemas/chat-effort";

const STATUS_OPTIONS: readonly SegmentedOption<ChatStatus>[] = [
  { value: "ready", label: "Ready" },
  { value: "submitted", label: "Submitted" },
  { value: "streaming", label: "Streaming" },
  { value: "error", label: "Error" },
];

const MARKDOWN_OPTIONS: readonly SegmentedOption<InputMarkdownMode>[] = [
  { value: "edit", label: "Edit" },
  { value: "preview", label: "Preview" },
];

const CONTEXT_EFFORT_OPTIONS: readonly SegmentedOption<ContextEffortLevel>[] =
  CONTEXT_EFFORT_LEVELS.map((level) => ({
    value: level,
    label: CONTEXT_EFFORT_BUDGETS[level].name,
  }));

const MODEL_OPTIONS = getSelectableChatModels(true).map((model) => ({
  value: model.id,
  label: model.name,
}));

const BUDGET_MODEL_OPTIONS = ChatModels.map((model) => ({
  value: model.id,
  label: model.name,
}));

type FocusPanelProps = {
  state: FocusLabState;
  patch: (patch: LabPatch<FocusLabState>) => void;
  chat: SimulatedChat;
  onResetLab: () => void;
};

export function FocusPanel({ state, patch, chat, onResetLab }: FocusPanelProps) {
  const effortOptions = useMemo<SegmentedOption<ChatEffortLevel>[]>(
    () => getEffortLevelsForModel(state.modelId).map((row) => ({ value: row.id, label: row.name })),
    [state.modelId]
  );
  const budgetPreview = useMemo(
    () => makeLabBudget({ modelId: state.budgetModelId, fillRatio: state.budgetFill }),
    [state.budgetFill, state.budgetModelId]
  );

  return (
    <LabPanel>
      <PanelSection
        hint="What CoreInput derives from the shell width; here you set it directly."
        title="Layout"
      >
        <ToggleRow
          checked={state.showLabels}
          label="showLabels"
          onCheckedChange={(showLabels) => patch({ showLabels })}
        />
        <ToggleRow
          checked={state.useCondensedLayout}
          label="useCondensedLayout"
          onCheckedChange={(useCondensedLayout) => patch({ useCondensedLayout })}
        />
      </PanelSection>

      <PanelSection hint="Clicking a live chip changes these too." title="Toggles">
        <ToggleRow
          checked={state.useWebSearch}
          label="Web search"
          onCheckedChange={(useWebSearch) => patch({ useWebSearch })}
        />
        <ToggleRow
          checked={state.useMemories}
          label="Memory"
          onCheckedChange={(useMemories) => patch({ useMemories })}
        />
        <ToggleRow
          checked={state.useSpeechFriendly}
          label="Speech-friendly"
          onCheckedChange={(useSpeechFriendly) => patch({ useSpeechFriendly })}
        />
        <SegmentedRow
          label="Markdown mode"
          options={MARKDOWN_OPTIONS}
          value={state.inputMarkdownMode}
          onChange={(inputMarkdownMode) => patch({ inputMarkdownMode })}
        />
      </PanelSection>

      <PanelSection hint="Effort options follow the model, as in the composer." title="Model">
        <SelectRow
          label="Model"
          options={MODEL_OPTIONS}
          value={state.modelId}
          onChange={(modelId) => patch({ modelId })}
        />
        <SegmentedRow
          label="Effort"
          options={effortOptions}
          value={state.effort}
          onChange={(effort) => patch({ effort })}
        />
      </PanelSection>

      <PanelSection title="Context effort">
        <ToggleRow
          checked={state.showContextEffort}
          label="Show in toolbar"
          onCheckedChange={(showContextEffort) => patch({ showContextEffort })}
        />
        <SegmentedRow
          label="Level"
          options={CONTEXT_EFFORT_OPTIONS}
          value={state.contextEffort}
          onChange={(contextEffort) => patch({ contextEffort })}
        />
      </PanelSection>

      <PanelSection
        hint="Shared with the send buttons; a live send runs the same timeline as the product view."
        title="Send"
      >
        <SegmentedRow
          label="Chat status"
          options={STATUS_OPTIONS}
          value={chat.status}
          onChange={chat.setStatus}
        />
        <TextRow
          label="Draft text"
          placeholder="Anything here counts as a draft"
          value={state.draftText}
          onChange={(draftText) => patch({ draftText })}
        />
      </PanelSection>

      <PanelSection
        hint="Fixture budget; Memory and Web search above shape its segments."
        title="Context budget"
      >
        <RangeRow
          format={(value) => `${Math.round(value * 100)}%`}
          label="Fill"
          max={1}
          min={0}
          step={0.01}
          value={state.budgetFill}
          onChange={(budgetFill) => patch({ budgetFill })}
        />
        <SelectRow
          label="Window model"
          options={BUDGET_MODEL_OPTIONS}
          value={state.budgetModelId}
          onChange={(budgetModelId) => patch({ budgetModelId })}
        />
        <ReadoutRow
          label="Input budget"
          value={`${formatTokenCount(budgetPreview.nextSubmitTokens)} / ${formatTokenCount(
            budgetPreview.inputBudgetTokens
          )}`}
        />
      </PanelSection>

      <PanelSection title="Actions">
        <PanelButton tone="danger" onClick={onResetLab}>
          Reset lab
        </PanelButton>
        <PanelNote>
          Nothing in this view touches localStorage prefs or user settings; it is all lab state.
        </PanelNote>
      </PanelSection>
    </LabPanel>
  );
}

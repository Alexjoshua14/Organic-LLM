"use client";

import type { ChatStatus } from "ai";
import type {
  LabBackdrop,
  LabExperience,
  LabSendOutcome,
  ProductLabState,
} from "../_lib/lab-state";
import type { SimulatedChat } from "../_lib/use-simulated-chat";

import { STAGE_WIDTH_PRESETS, STAGE_WIDTH_RANGE } from "../_lib/lab-state";
import { SIMULATED_SEND_TIMELINE } from "../_lib/use-simulated-chat";

import {
  LabPanel,
  PanelButton,
  PanelNote,
  PanelSection,
  PresetRow,
  RangeRow,
  ReadoutRow,
  SegmentedRow,
  SelectRow,
  ToggleRow,
  type SegmentedOption,
} from "./lab-panel";

import { CHAT_EXPERIENCES } from "@/lib/chat/chat-experience";

const STATUS_OPTIONS: readonly SegmentedOption<ChatStatus>[] = [
  { value: "ready", label: "Ready" },
  { value: "submitted", label: "Submitted" },
  { value: "streaming", label: "Streaming" },
  { value: "error", label: "Error" },
];

const OUTCOME_OPTIONS: readonly SegmentedOption<LabSendOutcome>[] = [
  { value: "complete", label: "Completes" },
  { value: "error", label: "Fails" },
];

const BACKDROP_OPTIONS: readonly SegmentedOption<LabBackdrop>[] = [
  { value: "chat", label: "Chat page" },
  { value: "chrome", label: "Liquid chrome" },
];

const VARIANT_OPTIONS: readonly SegmentedOption<ProductLabState["variant"]>[] = [
  { value: "default", label: "Default" },
  { value: "compact", label: "Compact" },
];

const SUBMIT_OPTIONS: readonly SegmentedOption<ProductLabState["submitVariant"]>[] = [
  { value: "default", label: "Default" },
  { value: "organic-glass", label: "Organic glass" },
];

const EXPERIENCE_OPTIONS: readonly SegmentedOption<LabExperience>[] = [
  { value: "none", label: "none (undefined)" },
  ...CHAT_EXPERIENCES.map((experience) => ({ value: experience, label: experience })),
];

const WIDTH_PRESET_OPTIONS = STAGE_WIDTH_PRESETS.map((preset) => ({
  label: `${preset.label} ${preset.widthPx}`,
  value: preset.widthPx,
}));

type ProductPanelProps = {
  state: ProductLabState;
  patch: (patch: Partial<ProductLabState>) => void;
  chat: SimulatedChat;
  contextEffortBeta: boolean;
  onContextEffortBetaChange: (enabled: boolean) => void;
  onRemount: () => void;
  onResetComposerPrefs: () => void;
  onResetLab: () => void;
};

export function ProductPanel({
  state,
  patch,
  chat,
  contextEffortBeta,
  onContextEffortBetaChange,
  onRemount,
  onResetComposerPrefs,
  onResetLab,
}: ProductPanelProps) {
  return (
    <LabPanel>
      <PanelSection
        hint="Width is the shell's max width; the readout under the stage shows what it measured."
        title="Stage"
      >
        <RangeRow
          format={(value) => `${value}px`}
          label="Width"
          max={STAGE_WIDTH_RANGE.max}
          min={STAGE_WIDTH_RANGE.min}
          step={STAGE_WIDTH_RANGE.step}
          value={state.stageWidthPx}
          onChange={(stageWidthPx) => patch({ stageWidthPx })}
        />
        <PresetRow
          active={state.stageWidthPx}
          options={WIDTH_PRESET_OPTIONS}
          onSelect={(stageWidthPx) => patch({ stageWidthPx })}
        />
        <SegmentedRow
          label="Backdrop"
          options={BACKDROP_OPTIONS}
          value={state.backdrop}
          onChange={(backdrop) => patch({ backdrop })}
        />
        <ToggleRow
          checked={state.showThread}
          label="Sample thread above"
          onCheckedChange={(showThread) => patch({ showThread })}
        />
        <ToggleRow
          checked={state.showStageBounds}
          label="Stage outline"
          onCheckedChange={(showStageBounds) => patch({ showStageBounds })}
        />
      </PanelSection>

      <PanelSection
        hint={`Type and press Enter to run submitted (${SIMULATED_SEND_TIMELINE.submittedMs} ms) → streaming (${SIMULATED_SEND_TIMELINE.streamingMs} ms) → done. Pinning a status cancels the run.`}
        title="Status"
      >
        <SegmentedRow
          label="Chat status"
          options={STATUS_OPTIONS}
          value={chat.status}
          onChange={chat.setStatus}
        />
        <SegmentedRow
          hint="Failing restores the sent text into the composer, as a rate limit would."
          label="Next send"
          options={OUTCOME_OPTIONS}
          value={state.sendOutcome}
          onChange={(sendOutcome) => patch({ sendOutcome })}
        />
        <ReadoutRow
          label={chat.lastSend?.kind === "steer" ? "Last steer" : "Last send"}
          value={chat.lastSend ? chat.lastSend.text.trim() || "(attachments only)" : "—"}
        />
      </PanelSection>

      <PanelSection hint="Each row maps to a CoreInput prop of the same name." title="Props">
        <SegmentedRow
          label="variant"
          options={VARIANT_OPTIONS}
          value={state.variant}
          onChange={(variant) => patch({ variant })}
        />
        <SegmentedRow
          label="submitVariant"
          options={SUBMIT_OPTIONS}
          value={state.submitVariant}
          onChange={(submitVariant) => patch({ submitVariant })}
        />
        <SelectRow
          label="experience"
          options={EXPERIENCE_OPTIONS}
          value={state.experience}
          onChange={(experience) => patch({ experience })}
        />
        <ToggleRow
          checked={state.speechChip}
          hint="useSpeechFriendlyRef provided"
          label="Speech chip"
          onCheckedChange={(speechChip) => patch({ speechChip })}
        />
        <ToggleRow
          checked={state.enableMarkdownInputPreview}
          label="enableMarkdownInputPreview"
          onCheckedChange={(enableMarkdownInputPreview) => patch({ enableMarkdownInputPreview })}
        />
        <ToggleRow
          checked={state.hideWebMemorySpeechToggles}
          label="hideWebMemorySpeechToggles"
          onCheckedChange={(hideWebMemorySpeechToggles) => patch({ hideWebMemorySpeechToggles })}
        />
        <ToggleRow
          checked={state.showContextBudget}
          label="showContextBudget"
          onCheckedChange={(showContextBudget) => patch({ showContextBudget })}
        />
        <ToggleRow
          checked={state.steerButton}
          hint="onSecondarySubmit provided (⌘/Ctrl+Enter)"
          label="Steer button"
          onCheckedChange={(steerButton) => patch({ steerButton })}
        />
        <ToggleRow
          checked={state.steerPending}
          disabled={!state.steerButton}
          label="secondarySubmitPending"
          onCheckedChange={(steerPending) => patch({ steerPending })}
        />
        <ToggleRow
          checked={state.sentMessageShimmer}
          hint="Shimmer the sent text while in flight"
          label="sentMessageShimmer"
          onCheckedChange={(sentMessageShimmer) => patch({ sentMessageShimmer })}
        />
        <ToggleRow
          checked={state.disabled}
          label="disabled"
          onCheckedChange={(disabled) => patch({ disabled })}
        />
        <ToggleRow
          checked={state.featureHints}
          hint="First-run coachmarks (dismissals persist)"
          label="featureHints"
          onCheckedChange={(featureHints) => patch({ featureHints })}
        />
      </PanelSection>

      <PanelSection
        hint="Same switch as Settings → Advanced. Writes the real user setting."
        title="Beta flags"
      >
        <ToggleRow
          checked={contextEffortBeta}
          hint="Slider shows for Arcadia with Memory on"
          label="Context effort slider"
          onCheckedChange={onContextEffortBetaChange}
        />
      </PanelSection>

      <PanelSection title="Actions">
        <PanelButton onClick={onRemount}>Remount composer</PanelButton>
        <PanelButton onClick={onResetComposerPrefs}>Reset composer prefs</PanelButton>
        <PanelButton tone="danger" onClick={onResetLab}>
          Reset lab
        </PanelButton>
        <PanelNote>
          Model, effort, and memory persist under lab-only keys. Web search and speech-friendly
          share the real chat&apos;s keys, so those toggles carry over.
        </PanelNote>
      </PanelSection>
    </LabPanel>
  );
}

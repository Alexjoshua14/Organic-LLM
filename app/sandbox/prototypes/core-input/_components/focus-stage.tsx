"use client";

import type { ChatStatus } from "ai";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";
import type { CoreInputControlsValue } from "@/components/chat/core-input/core-input-context";
import type { OrganicSubmitState } from "@/components/chat/core-input/submit/submit-glyph";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { FocusLabState, LabPatch } from "../_lib/lab-state";
import type { SimulatedChat } from "../_lib/use-simulated-chat";

import { useMemo } from "react";
import { MicIcon, PlusIcon } from "lucide-react";

import { LAB_BUDGET_FILL_RAMP, makeLabBudget } from "../_lib/lab-budget";

import { ComposerActionButton } from "@/components/chat/composer-action-button";
import { ComposerAddFilesButton } from "@/components/chat/composer-add-files-button";
import { ComposerMicButton } from "@/components/chat/composer-mic-button";
import { ComposerSettingsMenu } from "@/components/chat/composer-settings-menu";
import {
  ContextBudgetIndicatorView,
  ContextBudgetPopover,
  ContextDonut,
} from "@/components/chat/context-budget-indicator";
import { CoreInputControlsProvider } from "@/components/chat/core-input/core-input-context";
import { ComposerContextEffortSlider } from "@/components/chat/core-input/controls/context-effort-slider";
import { ComposerEffortSelect } from "@/components/chat/core-input/controls/effort-select";
import { ComposerModelEffortSelect } from "@/components/chat/core-input/controls/model-effort-select";
import { ComposerModelSelect } from "@/components/chat/core-input/controls/model-select";
import { ComposerPreviewChip } from "@/components/chat/core-input/controls/preview-chip";
import { ComposerSpeechChip } from "@/components/chat/core-input/controls/speech-chip";
import { ComposerToolToggleGroup } from "@/components/chat/core-input/controls/tool-toggle-group";
import {
  organicGlassSubmitClassName,
  PromptInputSubmit,
} from "@/components/chat/core-input/submit/submit-button";
import {
  OrganicSubmitGlyph,
  resolveOrganicSubmitState,
} from "@/components/chat/core-input/submit/submit-glyph";
import { HomeComposerLumenShell } from "@/components/chat/home-composer-lumen-shell";
import { glass } from "@/components/design-system/primitives";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/third-party/ai-elements/prompt-input";
import { formatTokenCount } from "@/lib/chat/context-budget";
import { CONTEXT_EFFORT_BUDGETS } from "@/lib/memory/context-effort";
import { AUTO_CHAT_MODEL, chatModelById, getSelectableChatModels } from "@/lib/schemas/chat";
import { clampEffortForModel } from "@/lib/schemas/chat-effort";
import { cn } from "@/lib/utils";

export type FocusControlId =
  | "toolbar"
  | "tool-toggles"
  | "speech-chip"
  | "preview-chip"
  | "model-effort"
  | "context-effort"
  | "context-budget"
  | "submit"
  | "settings-menu"
  | "attachments"
  | "lumen-shell";

export type FocusControl = {
  id: FocusControlId;
  title: string;
  /** Relative to `components/chat/`. */
  file: string;
  blurb: string;
};

/** Order here is the gallery order. Deep-link any entry with `?view=focus&control=<id>`. */
export const FOCUS_CONTROLS: readonly FocusControl[] = [
  {
    id: "toolbar",
    title: "Assembled toolbar",
    file: "core-input/core-input.tsx (footer)",
    blurb:
      "Every footer control in the production arrangement, minus CoreInput's own state. The place for spacing and grouping work.",
  },
  {
    id: "tool-toggles",
    title: "Tool toggles",
    file: "core-input/controls/tool-toggle-group.tsx",
    blurb: "Search and Memory chips — the capabilities granted to the model for the next turn.",
  },
  {
    id: "speech-chip",
    title: "Speech chip",
    file: "core-input/controls/speech-chip.tsx",
    blurb: "Speech-friendly reply formatting. Renders only when the surface passes a speech ref.",
  },
  {
    id: "preview-chip",
    title: "Preview chip",
    file: "core-input/controls/preview-chip.tsx",
    blurb: "Markdown edit / preview toggle. Sits a tier below the tool toggles while idle.",
  },
  {
    id: "model-effort",
    title: "Model + effort",
    file: "core-input/controls/model-effort-select.tsx",
    blurb:
      "One outlined control split into two segments. Effort slides under the model for models without a reasoning dial.",
  },
  {
    id: "context-effort",
    title: "Context effort slider",
    file: "core-input/controls/context-effort-slider.tsx",
    blurb:
      "Organic LLM memory compilation effort — Instant / Quick / Heavy. Arcadia-only, behind the beta flag.",
  },
  {
    id: "context-budget",
    title: "Context usage badge",
    file: "context-budget-indicator.tsx",
    blurb:
      "The kelvin-tinted ring in the composer corner and its hover breakdown, driven by a fixture budget.",
  },
  {
    id: "submit",
    title: "Send button",
    file: "core-input/submit/submit-button.tsx · submit-glyph.tsx",
    blurb:
      "Default submit across chat statuses, plus the organic-glass prototype and its glyph states.",
  },
  {
    id: "settings-menu",
    title: "Overflow menu",
    file: "composer-settings-menu.tsx",
    blurb: "Where speech, preview, and steer go when the footer is condensed.",
  },
  {
    id: "attachments",
    title: "Add files + mic",
    file: "composer-add-files-button.tsx · composer-mic-button.tsx",
    blurb: "Attachment and dictation actions on the right of the tools row.",
  },
  {
    id: "lumen-shell",
    title: "Memory lumen shell",
    file: "home-composer-lumen-shell.tsx",
    blurb: "The warm rim CoreInput wraps itself in while Memory is on. Most visible in dark mode.",
  },
];

export function parseFocusControl(raw: string | null): FocusControlId | "all" {
  return FOCUS_CONTROLS.some((control) => control.id === raw) ? (raw as FocusControlId) : "all";
}

const DEFAULT_SUBMIT_STATUSES: readonly ChatStatus[] = ["ready", "submitted", "streaming", "error"];
const GLYPH_STATES: readonly OrganicSubmitState[] = ["idle", "ready", "sent", "awaiting", "error"];

const noop = () => undefined;

/** Pinned cells keep their state: every setter is inert. */
const INERT_SETTERS: Pick<
  CoreInputControlsValue,
  | "setUseWebSearch"
  | "setUseMemories"
  | "setUseSpeechFriendly"
  | "setInputMarkdownMode"
  | "onModelChange"
  | "onEffortChange"
  | "onContextEffortChange"
> = {
  setUseWebSearch: noop,
  setUseMemories: noop,
  setUseSpeechFriendly: noop,
  setInputMarkdownMode: noop,
  onModelChange: noop,
  onEffortChange: noop,
  onContextEffortChange: noop,
};

type BoolKey = "useWebSearch" | "useMemories" | "useSpeechFriendly";

/** Lab-owned replacement for the value `CoreInput` normally builds from its own state. */
function useLabControlsValue(
  state: FocusLabState,
  patch: (patch: LabPatch<FocusLabState>) => void
): CoreInputControlsValue {
  return useMemo(() => {
    const boolSetter =
      (key: BoolKey): Dispatch<SetStateAction<boolean>> =>
      (next) =>
        patch((prev) => {
          const value = typeof next === "function" ? next(prev[key]) : next;

          return { [key]: value } as Partial<FocusLabState>;
        });

    return {
      showLabels: state.showLabels,
      useCondensedLayout: state.useCondensedLayout,
      useWebSearch: state.useWebSearch,
      setUseWebSearch: boolSetter("useWebSearch"),
      useMemories: state.useMemories,
      setUseMemories: boolSetter("useMemories"),
      useSpeechFriendly: state.useSpeechFriendly,
      setUseSpeechFriendly: boolSetter("useSpeechFriendly"),
      inputMarkdownMode: state.inputMarkdownMode,
      setInputMarkdownMode: (next) =>
        patch((prev) => ({
          inputMarkdownMode: typeof next === "function" ? next(prev.inputMarkdownMode) : next,
        })),
      model: chatModelById(state.modelId) ?? AUTO_CHAT_MODEL,
      // Admin-only rows included: the lab is for looking at every picker row.
      selectableModels: getSelectableChatModels(true),
      onModelChange: (id) =>
        patch((prev) => ({ modelId: id, effort: clampEffortForModel(id, prev.effort) })),
      effort: state.effort,
      onEffortChange: (id) =>
        patch((prev) => ({ effort: clampEffortForModel(prev.modelId, id as ChatEffortLevel) })),
      showContextEffort: state.showContextEffort,
      contextEffort: state.contextEffort,
      onContextEffortChange: (level) => patch({ contextEffort: level }),
    };
  }, [patch, state]);
}

// ---------------------------------------------------------------------------
// Surfaces and card chrome
// ---------------------------------------------------------------------------

/** Nested provider that holds a state; interaction inside does nothing. */
function Pinned({
  base,
  overrides,
  children,
}: {
  base: CoreInputControlsValue;
  overrides: Partial<CoreInputControlsValue>;
  children: ReactNode;
}) {
  return (
    <CoreInputControlsProvider value={{ ...base, ...INERT_SETTERS, ...overrides }}>
      {children}
    </CoreInputControlsProvider>
  );
}

/**
 * The production shell (`PromptInput` → opaque glass InputGroup) with only the footer row,
 * so chips and selects sit on the surface they ship on.
 */
function ComposerSurface({
  children,
  className,
  onSubmit,
}: {
  children: ReactNode;
  className?: string;
  onSubmit?: (text: string) => void;
}) {
  return (
    <PromptInput
      className={cn("w-full", className)}
      onSubmit={(message) => onSubmit?.(message.text)}
    >
      <PromptInputFooter className="overflow-visible pt-3">{children}</PromptInputFooter>
    </PromptInput>
  );
}

/** Header + textarea + footer, the same slots CoreInput fills, without its state. */
function MiniComposer({
  footer,
  corner,
  placeholder = "What would you like to know?",
  onSubmit,
}: {
  footer: ReactNode;
  corner?: ReactNode;
  placeholder?: string;
  onSubmit?: (text: string) => void;
}) {
  return (
    <PromptInput className="w-full" onSubmit={(message) => onSubmit?.(message.text)}>
      {corner ? <div className="absolute right-1.5 top-1 z-20">{corner}</div> : null}
      <PromptInputHeader className="p-0">
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
      </PromptInputHeader>
      <PromptInputBody>
        <PromptInputTextarea placeholder={placeholder} />
      </PromptInputBody>
      <PromptInputFooter className="overflow-visible">{footer}</PromptInputFooter>
    </PromptInput>
  );
}

function FocusCard({
  control,
  focused,
  onFocus,
  children,
}: {
  control: FocusControl;
  focused: boolean;
  onFocus: (control: FocusControlId | "all") => void;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(glass({ border: "all" }), "overflow-visible rounded-2xl p-4 sm:p-5")}
      id={`control-${control.id}`}
    >
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-commissioner text-lg font-light tracking-tight text-foreground">
            {control.title}
          </h2>
          <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
            components/chat/{control.file}
          </p>
          <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
            {control.blurb}
          </p>
        </div>
        <button
          className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          type="button"
          onClick={() => onFocus(focused ? "all" : control.id)}
        >
          {focused ? "Show all" : "Focus"}
        </button>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function StateGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return (
    <div className={cn("grid gap-4", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {children}
    </div>
  );
}

function StateCell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <p className="text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="overflow-visible py-1">{children}</div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {children}
      <span className="font-mono text-2xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

type CardContext = {
  value: CoreInputControlsValue;
  state: FocusLabState;
  chat: SimulatedChat;
  budget: ContextBudgetEstimate;
};

function settingsMenuPropsFor({ value, state, chat }: CardContext) {
  return {
    enableMarkdownInputPreview: true,
    hasDraft: state.draftText.trim().length > 0,
    inputMarkdownMode: value.inputMarkdownMode,
    onMarkdownModeToggle: () =>
      value.setInputMarkdownMode((mode) => (mode === "edit" ? "preview" : "edit")),
    onSecondarySubmit: () => chat.recordSteer(state.draftText),
    secondarySubmitLabel: "Steer assist",
    useSpeechFriendly: value.useSpeechFriendly,
    onSpeechFriendlyChange: (next: boolean) => value.setUseSpeechFriendly(next),
  };
}

function sendFromSurface(ctx: CardContext, text: string) {
  void ctx.chat.sendMessage({ text: text || ctx.state.draftText || "Lab send" });
}

function ToolbarCard(ctx: CardContext) {
  const { value, chat, budget } = ctx;
  const condensed = value.useCondensedLayout;

  return (
    <StateCell label="Interactive · production arrangement">
      <MiniComposer
        corner={<ContextBudgetIndicatorView budget={budget} />}
        footer={
          <>
            <div className="min-w-0 flex-1 overflow-visible">
              <PromptInputTools className="flex min-w-0 w-full items-center justify-between gap-1 overflow-visible">
                <div className="flex min-w-0 items-center gap-3 overflow-visible">
                  <ComposerToolToggleGroup />
                  {!condensed ? <ComposerSpeechChip /> : null}
                  {!condensed ? <ComposerPreviewChip /> : null}
                  <ComposerModelEffortSelect />
                  {value.showContextEffort ? <ComposerContextEffortSlider /> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ComposerAddFilesButton />
                  <ComposerMicButton />
                  {condensed ? <ComposerSettingsMenu {...settingsMenuPropsFor(ctx)} /> : null}
                </div>
              </PromptInputTools>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <PromptInputSubmit status={chat.status} stop={() => void chat.stop()} />
            </div>
          </>
        }
        onSubmit={(text) => sendFromSurface(ctx, text)}
      />
    </StateCell>
  );
}

function ToolTogglesCard({ value }: CardContext) {
  const cells = [
    { label: "Both off", useWebSearch: false, useMemories: false },
    { label: "Search on", useWebSearch: true, useMemories: false },
    { label: "Memory on", useWebSearch: false, useMemories: true },
    { label: "Both on", useWebSearch: true, useMemories: true },
  ];

  return (
    <>
      <StateCell label="Interactive">
        <ComposerSurface>
          <ComposerToolToggleGroup />
        </ComposerSurface>
      </StateCell>
      <StateGrid>
        {cells.map((cell) => (
          <StateCell key={cell.label} label={cell.label}>
            <Pinned
              base={value}
              overrides={{ useWebSearch: cell.useWebSearch, useMemories: cell.useMemories }}
            >
              <ComposerSurface>
                <ComposerToolToggleGroup />
              </ComposerSurface>
            </Pinned>
          </StateCell>
        ))}
      </StateGrid>
    </>
  );
}

function SpeechChipCard({ value }: CardContext) {
  return (
    <>
      <StateCell label="Interactive">
        <ComposerSurface>
          <ComposerSpeechChip />
        </ComposerSurface>
      </StateCell>
      <StateGrid>
        {[false, true].map((on) => (
          <StateCell key={String(on)} label={on ? "On" : "Off"}>
            <Pinned base={value} overrides={{ useSpeechFriendly: on }}>
              <ComposerSurface>
                <ComposerSpeechChip />
              </ComposerSurface>
            </Pinned>
          </StateCell>
        ))}
      </StateGrid>
    </>
  );
}

function PreviewChipCard({ value }: CardContext) {
  return (
    <>
      <StateCell label="Interactive">
        <ComposerSurface>
          <ComposerPreviewChip />
        </ComposerSurface>
      </StateCell>
      <StateGrid>
        <StateCell label="Editing (idle tier)">
          <Pinned base={value} overrides={{ inputMarkdownMode: "edit" }}>
            <ComposerSurface>
              <ComposerPreviewChip />
            </ComposerSurface>
          </Pinned>
        </StateCell>
        <StateCell label="Previewing (engaged)">
          <Pinned base={value} overrides={{ inputMarkdownMode: "preview" }}>
            <ComposerSurface>
              <ComposerPreviewChip />
            </ComposerSurface>
          </Pinned>
        </StateCell>
      </StateGrid>
    </>
  );
}

function ModelEffortCard({ value }: CardContext) {
  const noEffortModel = chatModelById("perplexity/sonar-pro") ?? value.model;

  return (
    <>
      <StateCell label="Interactive">
        <ComposerSurface>
          <ComposerModelEffortSelect />
        </ComposerSurface>
      </StateCell>
      <StateGrid>
        <StateCell label="Effort hidden · model without a dial">
          <Pinned base={value} overrides={{ model: noEffortModel, effort: "auto" }}>
            <ComposerSurface>
              <ComposerModelEffortSelect />
            </ComposerSurface>
          </Pinned>
        </StateCell>
        <StateCell label="Condensed">
          <Pinned base={value} overrides={{ useCondensedLayout: true }}>
            <ComposerSurface>
              <ComposerModelEffortSelect />
            </ComposerSurface>
          </Pinned>
        </StateCell>
        <StateCell label="Model half alone">
          <ComposerSurface>
            <ComposerModelSelect />
          </ComposerSurface>
        </StateCell>
        <StateCell label="Effort half alone">
          <ComposerSurface>
            <ComposerEffortSelect />
          </ComposerSurface>
        </StateCell>
      </StateGrid>
    </>
  );
}

function ContextEffortCard({ value }: CardContext) {
  const budget = CONTEXT_EFFORT_BUDGETS[value.contextEffort];
  const rows: Array<[string, string]> = [
    ["Wall clock", `${budget.budgetMs} ms`],
    ["Planner", budget.plannerTimeoutMs == null ? "skipped" : `${budget.plannerTimeoutMs} ms`],
    ["Inject cap", `${budget.injectCap} memories`],
    ["Token cap", formatTokenCount(budget.combinedTokenCap)],
    ["Portrait", budget.includeProfile ? `${budget.profileMaxSections} sections` : "off"],
  ];

  return (
    <>
      <StateCell label="Interactive">
        <ComposerSurface>
          <ComposerContextEffortSlider />
        </ComposerSurface>
      </StateCell>
      <StateGrid columns={3}>
        <StateCell label="Stop labels · wide">
          <Pinned base={value} overrides={{ showLabels: true, useCondensedLayout: false }}>
            <ComposerSurface>
              <ComposerContextEffortSlider />
            </ComposerSurface>
          </Pinned>
        </StateCell>
        <StateCell label="Inline label · icons">
          <Pinned base={value} overrides={{ showLabels: false, useCondensedLayout: false }}>
            <ComposerSurface>
              <ComposerContextEffortSlider />
            </ComposerSurface>
          </Pinned>
        </StateCell>
        <StateCell label="Condensed">
          <Pinned base={value} overrides={{ showLabels: false, useCondensedLayout: true }}>
            <ComposerSurface>
              <ComposerContextEffortSlider />
            </ComposerSurface>
          </Pinned>
        </StateCell>
      </StateGrid>
      <StateCell label={`What “${budget.name}” buys`}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {rows.map(([term, detail]) => (
            <div key={term} className="contents">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="font-mono text-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
      </StateCell>
    </>
  );
}

function ContextBudgetCard({ state, value, budget }: CardContext) {
  return (
    <>
      <StateGrid>
        <StateCell label="Badge in the composer corner · hover for breakdown">
          <MiniComposer
            corner={<ContextBudgetIndicatorView budget={budget} />}
            footer={
              <div className="ml-auto">
                <PromptInputSubmit status="ready" stop={noop} />
              </div>
            }
          />
        </StateCell>
        <StateCell label="Ring sizes">
          <div className="flex items-center gap-5 py-2">
            <Labeled label="xs">
              <ContextDonut budget={budget} size="xs" />
            </Labeled>
            <Labeled label="sm">
              <ContextDonut budget={budget} size="sm" />
            </Labeled>
            <Labeled label="lg">
              <ContextDonut budget={budget} size="lg" />
            </Labeled>
          </div>
        </StateCell>
      </StateGrid>
      <StateCell label="Fill ramp · xs">
        <div className="flex flex-wrap items-end gap-4">
          {LAB_BUDGET_FILL_RAMP.map((fill) => (
            <Labeled key={fill} label={`${Math.round(fill * 100)}%`}>
              <ContextDonut
                budget={makeLabBudget({
                  modelId: state.budgetModelId,
                  fillRatio: fill,
                  memoryEnabled: value.useMemories,
                  webSearchEnabled: value.useWebSearch,
                })}
                size="xs"
              />
            </Labeled>
          ))}
        </div>
      </StateCell>
      <StateCell label="Breakdown · pinned open">
        <div
          className={cn(
            "w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-border/60 p-0",
            glass()
          )}
        >
          <ContextBudgetPopover budget={budget} />
        </div>
      </StateCell>
    </>
  );
}

function SubmitCard(ctx: CardContext) {
  const { chat, state } = ctx;
  const hasText = state.draftText.trim().length > 0;

  return (
    <>
      <StateGrid>
        <StateCell label="Default · live status">
          <ComposerSurface onSubmit={(text) => sendFromSurface(ctx, text)}>
            <div className="ml-auto">
              <PromptInputSubmit status={chat.status} stop={() => void chat.stop()} />
            </div>
          </ComposerSurface>
        </StateCell>
        <StateCell label="Organic glass · live status">
          <ComposerSurface onSubmit={(text) => sendFromSurface(ctx, text)}>
            <div className="ml-auto">
              <PromptInputSubmit
                className={organicGlassSubmitClassName}
                status={chat.status}
                stop={() => void chat.stop()}
              >
                <OrganicSubmitGlyph state={resolveOrganicSubmitState(chat.status, hasText)} />
              </PromptInputSubmit>
            </div>
          </ComposerSurface>
        </StateCell>
      </StateGrid>
      <StateCell label="Default · every status">
        <ComposerSurface>
          <div className="flex flex-wrap items-end gap-5">
            {DEFAULT_SUBMIT_STATUSES.map((status) => (
              <Labeled key={status} label={status}>
                <PromptInputSubmit status={status} stop={noop} />
              </Labeled>
            ))}
          </div>
        </ComposerSurface>
      </StateCell>
      <StateCell label="Organic glass · every glyph state">
        <ComposerSurface>
          <div className="flex flex-wrap items-end gap-5">
            {GLYPH_STATES.map((glyph) => (
              <Labeled key={glyph} label={glyph}>
                <PromptInputSubmit
                  className={organicGlassSubmitClassName}
                  status="ready"
                  stop={noop}
                >
                  <OrganicSubmitGlyph state={glyph} />
                </PromptInputSubmit>
              </Labeled>
            ))}
          </div>
        </ComposerSurface>
      </StateCell>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Live cells share the lab status: press a send to run submitted → streaming → ready, or pin a
        status from the panel. Draft text in the panel switches the glyph between idle and ready.
      </p>
    </>
  );
}

function SettingsMenuCard(ctx: CardContext) {
  const props = settingsMenuPropsFor(ctx);
  const lastSteer = ctx.chat.lastSend?.kind === "steer" ? ctx.chat.lastSend.text : null;

  return (
    <>
      <StateGrid>
        <StateCell label="Interactive · all items">
          <ComposerSurface>
            <div className="ml-auto">
              <ComposerSettingsMenu {...props} />
            </div>
          </ComposerSurface>
        </StateCell>
        <StateCell label="Engaged · speech on (pinned)">
          <ComposerSurface>
            <div className="ml-auto">
              <ComposerSettingsMenu
                {...props}
                inputMarkdownMode="edit"
                useSpeechFriendly
                onSpeechFriendlyChange={noop}
              />
            </div>
          </ComposerSurface>
        </StateCell>
      </StateGrid>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Steer is enabled once the panel draft has text.
        {lastSteer != null ? ` Last steer: “${lastSteer.trim() || "(empty)"}”.` : ""}
      </p>
    </>
  );
}

function AttachmentsCard() {
  return (
    <>
      <StateCell label="Interactive · paste or drop files into the box">
        <MiniComposer
          footer={
            <div className="flex items-center gap-1">
              <ComposerAddFilesButton />
              <ComposerMicButton />
            </div>
          }
          placeholder="Paste an image here to see the attachment rail"
        />
      </StateCell>
      <StateGrid>
        <StateCell label="Add files · engaged (pinned)">
          <ComposerSurface>
            <ComposerActionButton engaged aria-label="Add files, pinned engaged">
              <PlusIcon className="size-4" />
            </ComposerActionButton>
          </ComposerSurface>
        </StateCell>
        <StateCell label="Mic · listening (pinned, rim pulse)">
          <ComposerSurface>
            <ComposerActionButton engaged rimPulse aria-label="Dictating, pinned">
              <MicIcon className="size-4" />
            </ComposerActionButton>
          </ComposerSurface>
        </StateCell>
      </StateGrid>
    </>
  );
}

function LumenShellCard({ value }: CardContext) {
  const footer = (
    <>
      <div className="min-w-0 flex-1 overflow-visible">
        <PromptInputTools className="flex items-center gap-3 overflow-visible">
          <ComposerToolToggleGroup />
          <ComposerModelEffortSelect />
        </PromptInputTools>
      </div>
      <PromptInputSubmit status="ready" stop={noop} />
    </>
  );

  return (
    <StateGrid>
      <StateCell label="Memory off · bare shell">
        <Pinned base={value} overrides={{ useMemories: false }}>
          <MiniComposer footer={footer} />
        </Pinned>
      </StateCell>
      <StateCell label="Memory on · core-input-memory-lumen">
        <Pinned base={value} overrides={{ useMemories: true }}>
          <HomeComposerLumenShell className="core-input-memory-lumen">
            <MiniComposer footer={footer} />
          </HomeComposerLumenShell>
        </Pinned>
      </StateCell>
    </StateGrid>
  );
}

function FocusCardBody({ id, ctx }: { id: FocusControlId; ctx: CardContext }) {
  switch (id) {
    case "toolbar":
      return <ToolbarCard {...ctx} />;
    case "tool-toggles":
      return <ToolTogglesCard {...ctx} />;
    case "speech-chip":
      return <SpeechChipCard {...ctx} />;
    case "preview-chip":
      return <PreviewChipCard {...ctx} />;
    case "model-effort":
      return <ModelEffortCard {...ctx} />;
    case "context-effort":
      return <ContextEffortCard {...ctx} />;
    case "context-budget":
      return <ContextBudgetCard {...ctx} />;
    case "submit":
      return <SubmitCard {...ctx} />;
    case "settings-menu":
      return <SettingsMenuCard {...ctx} />;
    case "attachments":
      return <AttachmentsCard />;
    case "lumen-shell":
      return <LumenShellCard {...ctx} />;
  }
}

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

type FocusStageProps = {
  state: FocusLabState;
  patch: (patch: LabPatch<FocusLabState>) => void;
  chat: SimulatedChat;
  control: FocusControlId | "all";
  onFocusControl: (control: FocusControlId | "all") => void;
};

export function FocusStage({ state, patch, chat, control, onFocusControl }: FocusStageProps) {
  const value = useLabControlsValue(state, patch);
  const budget = useMemo(
    () =>
      makeLabBudget({
        modelId: state.budgetModelId,
        fillRatio: state.budgetFill,
        memoryEnabled: state.useMemories,
        webSearchEnabled: state.useWebSearch,
      }),
    [state.budgetFill, state.budgetModelId, state.useMemories, state.useWebSearch]
  );
  const ctx: CardContext = { value, state, chat, budget };
  const visible =
    control === "all" ? FOCUS_CONTROLS : FOCUS_CONTROLS.filter((entry) => entry.id === control);

  return (
    <CoreInputControlsProvider value={value}>
      <div className="space-y-5">
        {visible.map((entry) => (
          <FocusCard
            key={entry.id}
            control={entry}
            focused={control === entry.id}
            onFocus={onFocusControl}
          >
            <FocusCardBody ctx={ctx} id={entry.id} />
          </FocusCard>
        ))}
      </div>
    </CoreInputControlsProvider>
  );
}

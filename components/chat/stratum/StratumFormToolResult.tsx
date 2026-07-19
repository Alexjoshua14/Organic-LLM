"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Layers, Send } from "lucide-react";

import { StratumBetaBadge } from "./StratumBetaBadge";

import { glass } from "@/components/design-system/primitives";
import {
  formatStratumFormAnswers,
  tryParseStratumFormToolOutput,
  type StratumAnswers,
  type StratumAnswerValue,
  type StratumField,
  type StratumForm,
} from "@/lib/schemas/stratum";
import { useChatSend } from "@/components/chat/chat-send-context";
import { cn } from "@/lib/utils";

const SCALE_POINTS = [1, 2, 3, 4, 5] as const;

const CUSTOM_OPTION_ID = "__custom__";

type StratumFormToolResultProps = {
  output: unknown;
  /** Only the form in the latest assistant message accepts input; older ones collapse. */
  interactive: boolean;
};

const fieldLabelClass = "text-xs font-medium text-foreground";
const fieldHintClass = "text-[11px] leading-snug text-muted-foreground";
const textInputClass =
  "w-full rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-border focus:outline-none";

function chipClass(active: boolean): string {
  return cn(
    "rounded-full border px-2.5 py-1 text-xs transition-colors",
    active
      ? "border-foreground/40 bg-background-tertiary/60 text-foreground"
      : "border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground"
  );
}

/** Compact chip shown once the form is answered or superseded by newer messages. */
function AnsweredChip({ form, submitted }: { form: StratumForm; submitted: boolean }) {
  return (
    <div className="not-prose inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background-tertiary/40 px-2.5 py-1 text-xs text-muted-foreground">
      <Layers className="size-3" />
      <span className="truncate">{form.title}</span>
      <span aria-hidden>·</span>
      {submitted ? (
        <span className="inline-flex items-center gap-1">
          <Check className="size-3" /> answers sent
        </span>
      ) : (
        <span>answered in chat</span>
      )}
    </div>
  );
}

function SelectField({
  field,
  value,
  customText,
  onPick,
  onCustomText,
}: {
  field: Extract<StratumField, { kind: "single_select" | "multi_select" }>;
  value: string[] | undefined;
  customText: string;
  onPick: (optionId: string) => void;
  onCustomText: (text: string) => void;
}) {
  const selected = value ?? [];
  const customActive = selected.includes(CUSTOM_OPTION_ID);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {field.options.map((option) => {
          const active = selected.includes(option.id);

          return (
            <button
              key={option.id}
              aria-pressed={active}
              className={chipClass(active)}
              title={option.description}
              type="button"
              onClick={() => onPick(option.id)}
            >
              {option.label}
            </button>
          );
        })}
        {field.allowCustom ? (
          <button
            aria-pressed={customActive}
            className={chipClass(customActive)}
            type="button"
            onClick={() => onPick(CUSTOM_OPTION_ID)}
          >
            Other…
          </button>
        ) : null}
      </div>
      {customActive ? (
        <input
          className={textInputClass}
          placeholder="Your answer"
          type="text"
          value={customText}
          onChange={(e) => onCustomText(e.target.value)}
        />
      ) : null}
    </div>
  );
}

function ScaleField({
  field,
  value,
  onPick,
}: {
  field: Extract<StratumField, { kind: "scale" }>;
  value: number | undefined;
  onPick: (point: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {SCALE_POINTS.map((point) => (
          <button
            key={point}
            aria-pressed={value === point}
            className={cn(
              "size-8 rounded-md border text-xs transition-colors",
              value === point
                ? "border-foreground/40 bg-background-tertiary/60 text-foreground"
                : "border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground"
            )}
            type="button"
            onClick={() => onPick(point)}
          >
            {point}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/80">
        <span>1 · {field.minLabel}</span>
        <span>5 · {field.maxLabel}</span>
      </div>
    </div>
  );
}

/**
 * Interactive discovery form emitted by the `discovery_form` tool. Answers are
 * serialized into a deterministic user message and sent back into the chat.
 */
export function StratumFormToolResult({ output, interactive }: StratumFormToolResultProps) {
  const parsed = useMemo(() => tryParseStratumFormToolOutput(output), [output]);
  const send = useChatSend();

  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [selectAnswers, setSelectAnswers] = useState<Record<string, string[]>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [scaleAnswers, setScaleAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const form = parsed?.form;

  const resolveFieldAnswer = useCallback(
    (field: StratumField): StratumAnswerValue | undefined => {
      switch (field.kind) {
        case "text":
        case "long_text": {
          const text = textAnswers[field.id]?.trim();

          return text ? text : undefined;
        }
        case "single_select":
        case "multi_select": {
          const picked = selectAnswers[field.id] ?? [];
          const labels = picked
            .map((optionId) =>
              optionId === CUSTOM_OPTION_ID
                ? customTexts[field.id]?.trim()
                : field.options.find((o) => o.id === optionId)?.label
            )
            .filter((label): label is string => Boolean(label && label.length > 0));

          if (labels.length === 0) return undefined;

          return field.kind === "single_select" ? labels[0] : labels;
        }
        case "scale":
          return scaleAnswers[field.id];
      }
    },
    [customTexts, scaleAnswers, selectAnswers, textAnswers]
  );

  const pickSelect = useCallback(
    (
      field: Extract<StratumField, { kind: "single_select" | "multi_select" }>,
      optionId: string
    ) => {
      setSelectAnswers((prev) => {
        const current = prev[field.id] ?? [];

        if (field.kind === "single_select") {
          return { ...prev, [field.id]: current.includes(optionId) ? [] : [optionId] };
        }

        return {
          ...prev,
          [field.id]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      });
    },
    []
  );

  if (!form) return null;

  if (!interactive || submitted) {
    return <AnsweredChip form={form} submitted={submitted} />;
  }

  const missingRequired = form.fields.some(
    (field) => field.optional !== true && resolveFieldAnswer(field) === undefined
  );
  const canSubmit = !missingRequired && send !== null;

  const handleSubmit = () => {
    if (!send) return;
    const answers: StratumAnswers = {};

    for (const field of form.fields) {
      const value = resolveFieldAnswer(field);

      if (value !== undefined) answers[field.id] = value;
    }

    send.sendText(formatStratumFormAnswers(form, answers));
    setSubmitted(true);
  };

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "not-prose overflow-hidden rounded-lg border border-border/50"
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2">
        <Layers className="size-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Discovery · {form.stage}
        </span>
        <span className="ml-auto">
          <StratumBetaBadge />
        </span>
      </div>
      <div className="space-y-4 px-3 py-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{form.title}</p>
          {form.intro ? <p className="text-xs text-muted-foreground">{form.intro}</p> : null}
        </div>

        {form.fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className={fieldLabelClass}>{field.label}</span>
              {field.optional ? (
                <span className="text-[10px] text-muted-foreground/70">optional</span>
              ) : null}
            </div>
            {field.hint ? <p className={fieldHintClass}>{field.hint}</p> : null}

            {field.kind === "text" ? (
              <input
                className={textInputClass}
                placeholder={field.placeholder ?? ""}
                type="text"
                value={textAnswers[field.id] ?? ""}
                onChange={(e) =>
                  setTextAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                }
              />
            ) : null}

            {field.kind === "long_text" ? (
              <textarea
                className={cn(textInputClass, "min-h-16 resize-y")}
                placeholder={field.placeholder ?? ""}
                rows={3}
                value={textAnswers[field.id] ?? ""}
                onChange={(e) =>
                  setTextAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                }
              />
            ) : null}

            {field.kind === "single_select" || field.kind === "multi_select" ? (
              <SelectField
                customText={customTexts[field.id] ?? ""}
                field={field}
                value={selectAnswers[field.id]}
                onCustomText={(text) => setCustomTexts((prev) => ({ ...prev, [field.id]: text }))}
                onPick={(optionId) => pickSelect(field, optionId)}
              />
            ) : null}

            {field.kind === "scale" ? (
              <ScaleField
                field={field}
                value={scaleAnswers[field.id]}
                onPick={(point) => setScaleAnswers((prev) => ({ ...prev, [field.id]: point }))}
              />
            ) : null}
          </div>
        ))}

        <div className="flex items-center justify-end gap-2 pt-1">
          {send === null ? (
            <span className="text-[11px] text-muted-foreground">
              Reply in the composer to answer.
            </span>
          ) : null}
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              canSubmit
                ? "border-foreground/30 bg-background-tertiary/60 text-foreground hover:border-foreground/50"
                : "cursor-not-allowed border-border/40 bg-background/20 text-muted-foreground/60"
            )}
            disabled={!canSubmit}
            type="button"
            onClick={handleSubmit}
          >
            <Send className="size-3" />
            {form.submitLabel ?? "Send answers"}
          </button>
        </div>
      </div>
    </div>
  );
}

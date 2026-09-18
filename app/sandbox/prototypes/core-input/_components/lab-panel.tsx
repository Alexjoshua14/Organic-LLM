"use client";

import type { ReactNode } from "react";

import { useId } from "react";

import { glass } from "@/components/design-system/primitives";
import { Switch } from "@/components/third-party/ui/switch";
import { cn } from "@/lib/utils";

/** Sticky side panel shell shared by both lab views. */
export function LabPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(glass({ border: "all" }), "space-y-5 rounded-2xl p-4", className)}>
      {children}
    </div>
  );
}

export function PanelSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
        {hint ? (
          <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground/80">{hint}</p>
        ) : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <div className={cn("flex items-center justify-between gap-3", disabled && "opacity-50")}>
      <label className="min-w-0 text-xs text-foreground" htmlFor={id}>
        {label}
        {hint ? <span className="block text-2xs text-muted-foreground">{hint}</span> : null}
      </label>
      <Switch checked={checked} disabled={disabled} id={id} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export type SegmentedOption<T extends string> = { value: T; label: string };

export function SegmentedRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-foreground">{label}</div>
      <div
        aria-label={label}
        className="flex flex-wrap gap-0.5 rounded-md bg-muted/50 p-0.5"
        role="radiogroup"
      >
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              aria-checked={active}
              className={cn(
                "rounded px-2 py-1 text-2xs font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              role="radio"
              type="button"
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function RangeRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-foreground" htmlFor={id}>
          {label}
        </label>
        <span className="font-mono text-2xs text-muted-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        className="w-full cursor-pointer accent-foreground"
        id={id}
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

const nativeFieldClass =
  "h-8 w-full rounded-md border border-border/60 bg-background/60 px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  const id = useId();

  return (
    <div className="space-y-1">
      <label className="text-xs text-foreground" htmlFor={id}>
        {label}
      </label>
      <select
        className={nativeFieldClass}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="space-y-1">
      <label className="text-xs text-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        className={nativeFieldClass}
        id={id}
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ReadoutRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-foreground">{value}</span>
    </div>
  );
}

export function PresetRow<T extends string | number>({
  options,
  active,
  onSelect,
}: {
  options: readonly { label: string; value: T }[];
  active?: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.label}
          className={cn(
            "rounded-full border px-2 py-0.5 text-2xs transition-colors",
            option.value === active
              ? "border-foreground/40 bg-foreground/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground"
          )}
          type="button"
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PanelButton({
  children,
  tone = "default",
  onClick,
}: {
  children: ReactNode;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-md border px-2.5 py-1.5 text-xs transition-colors",
        tone === "danger"
          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
          : "border-border/60 text-foreground hover:bg-muted/40"
      )}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="text-2xs leading-relaxed text-muted-foreground">{children}</p>;
}

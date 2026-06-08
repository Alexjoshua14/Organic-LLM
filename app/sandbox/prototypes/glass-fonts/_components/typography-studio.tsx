"use client";

import type { HeadingScale } from "../_lib/baseline-storage";

import { DEFAULT_HEADING_SCALE } from "../_lib/baseline-storage";
import {
  FAMILY_AXIS_DEFINITIONS,
  familyDisplayName,
  defaultAxisValuesForFamily,
  type FamilyAxisValues,
  type FontFamilyId,
  type AxisId,
} from "../_lib/font-axes";

import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const headingLabels: Array<{ key: keyof HeadingScale; label: string }> = [
  { key: "h1", label: "H1" },
  { key: "h2", label: "H2" },
  { key: "h3", label: "H3" },
  { key: "body", label: "Body" },
  { key: "overline", label: "Overline" },
];

function RangeControl({
  id,
  label,
  min,
  max,
  step,
  value,
  resetValue,
  revertValue,
  onReset,
  onRevert,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  resetValue: number;
  revertValue: number;
  onReset: () => void;
  onRevert: () => void;
  onChange: (next: number) => void;
}) {
  const canReset = value !== resetValue;
  const canRevert = value !== revertValue;

  return (
    <div className="block">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <label htmlFor={id}>{label}</label>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-foreground">{value}</span>
          <button
            className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground disabled:opacity-45"
            disabled={!canRevert}
            type="button"
            onClick={onRevert}
          >
            Revert
          </button>
          <button
            className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground disabled:opacity-45"
            disabled={!canReset}
            type="button"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
      <input
        id={id}
        className="w-full accent-[hsl(var(--accent))]"
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

export function TypographyStudio({
  family,
  axisValues,
  lockedAxisValues,
  headingScale,
  lockedHeadingScale,
  onAxisChange,
  onAxisReset,
  onAxisRevert,
  onHeadingChange,
  onHeadingReset,
  onHeadingRevert,
  onLockTypography,
}: {
  family: FontFamilyId;
  axisValues: FamilyAxisValues;
  lockedAxisValues: FamilyAxisValues;
  headingScale: HeadingScale;
  lockedHeadingScale: HeadingScale;
  onAxisChange: (axis: AxisId, value: number) => void;
  onAxisReset: (axis: AxisId) => void;
  onAxisRevert: (axis: AxisId) => void;
  onHeadingChange: (
    level: keyof HeadingScale,
    field: "sizeRem" | "lineHeight" | "trackingEm" | "weight",
    value: number
  ) => void;
  onHeadingReset: (
    level: keyof HeadingScale,
    field: "sizeRem" | "lineHeight" | "trackingEm" | "weight"
  ) => void;
  onHeadingRevert: (
    level: keyof HeadingScale,
    field: "sizeRem" | "lineHeight" | "trackingEm" | "weight"
  ) => void;
  onLockTypography: () => void;
}) {
  const axes = FAMILY_AXIS_DEFINITIONS[family];
  const defaultAxisValues = defaultAxisValuesForFamily(family);

  return (
    <div className="space-y-4">
      <section
        className={cn(
          glassPreview({ depth: "floating", interactive: true }),
          "rounded-[2rem] p-5 sm:p-6"
        )}
      >
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Typography lab
            </p>
            <h2 className="mt-1 text-2xl font-light tracking-tight text-foreground">
              {familyDisplayName(family)} variables
            </h2>
          </div>
          <button
            className="rounded-full border border-accent/30 bg-accent/12 px-4 py-2 text-xs font-medium tracking-[0.12em] text-accent uppercase"
            type="button"
            onClick={onLockTypography}
          >
            Lock typography
          </button>
        </div>

        <div className="grid gap-4">
          {axes.map((axis) => (
            <div
              className="rounded-xl border border-white/15 bg-background/24 p-3 dark:border-white/8"
              key={axis.id}
            >
              <RangeControl
                id={`${family}-${axis.id}`}
                label={`${axis.label} (${axis.id})`}
                max={axis.max}
                min={axis.min}
                step={axis.step}
                value={Number(axisValues[axis.id] ?? axis.defaultValue)}
                resetValue={Number(defaultAxisValues[axis.id] ?? axis.defaultValue)}
                revertValue={Number(lockedAxisValues[axis.id] ?? axis.defaultValue)}
                onReset={() => onAxisReset(axis.id)}
                onRevert={() => onAxisRevert(axis.id)}
                onChange={(next) => onAxisChange(axis.id, next)}
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{axis.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={cn(
          glassPreview({ depth: "floating", interactive: true }),
          "rounded-[2rem] p-5 sm:p-6"
        )}
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Heading refinement
        </p>
        <h2 className="mt-1 text-2xl font-light tracking-tight text-foreground">Scale tuning</h2>

        <div className="mt-4 space-y-4">
          {headingLabels.map(({ key, label }) => (
            <div
              className="rounded-xl border border-white/15 bg-background/24 p-3 dark:border-white/8"
              key={key}
            >
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </p>
              <div className="grid gap-3">
                <RangeControl
                  id={`heading-${key}-size`}
                  label="Size (rem)"
                  max={key === "h1" ? 4.5 : key === "h2" ? 3.3 : key === "h3" ? 2.4 : 1.5}
                  min={key === "overline" ? 0.6 : 0.85}
                  step={0.01}
                  value={Number(headingScale[key].sizeRem.toFixed(2))}
                  resetValue={Number(DEFAULT_HEADING_SCALE[key].sizeRem.toFixed(2))}
                  revertValue={Number(lockedHeadingScale[key].sizeRem.toFixed(2))}
                  onReset={() => onHeadingReset(key, "sizeRem")}
                  onRevert={() => onHeadingRevert(key, "sizeRem")}
                  onChange={(next) => onHeadingChange(key, "sizeRem", next)}
                />
                <RangeControl
                  id={`heading-${key}-line-height`}
                  label="Line-height"
                  max={2}
                  min={0.9}
                  step={0.01}
                  value={Number(headingScale[key].lineHeight.toFixed(2))}
                  resetValue={Number(DEFAULT_HEADING_SCALE[key].lineHeight.toFixed(2))}
                  revertValue={Number(lockedHeadingScale[key].lineHeight.toFixed(2))}
                  onReset={() => onHeadingReset(key, "lineHeight")}
                  onRevert={() => onHeadingRevert(key, "lineHeight")}
                  onChange={(next) => onHeadingChange(key, "lineHeight", next)}
                />
                <RangeControl
                  id={`heading-${key}-tracking`}
                  label="Tracking (em)"
                  max={0.35}
                  min={-0.09}
                  step={0.001}
                  value={Number(headingScale[key].trackingEm.toFixed(3))}
                  resetValue={Number(DEFAULT_HEADING_SCALE[key].trackingEm.toFixed(3))}
                  revertValue={Number(lockedHeadingScale[key].trackingEm.toFixed(3))}
                  onReset={() => onHeadingReset(key, "trackingEm")}
                  onRevert={() => onHeadingRevert(key, "trackingEm")}
                  onChange={(next) => onHeadingChange(key, "trackingEm", next)}
                />
                <RangeControl
                  id={`heading-${key}-weight`}
                  label="Weight"
                  max={900}
                  min={100}
                  step={1}
                  value={Number(headingScale[key].weight)}
                  resetValue={Number(DEFAULT_HEADING_SCALE[key].weight)}
                  revertValue={Number(lockedHeadingScale[key].weight)}
                  onReset={() => onHeadingReset(key, "weight")}
                  onRevert={() => onHeadingRevert(key, "weight")}
                  onChange={(next) => onHeadingChange(key, "weight", next)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

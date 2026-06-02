"use client";

import type { CSSProperties } from "react";

import { useEffect, useMemo, useState } from "react";

import {
  buildFontVariationSettings,
  defaultAxisValuesForFamily,
  familyClassName,
  familyDisplayName,
  FONT_FAMILIES,
  type AxisId,
  type FontFamilyId,
} from "../_lib/font-axes";
import {
  createDefaultGlassFontsBaselineState,
  DEFAULT_HEADING_SCALE,
  loadGlassFontsBaselineState,
  saveGlassFontsBaselineState,
  type GlassFontsBaselineState,
  type HeadingScale,
} from "../_lib/baseline-storage";

import { FontComparisonGrid } from "./font-comparison-grid";
import { TypographyStudio } from "./typography-studio";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { TextCopyModal } from "@/components/design-system/TextCopyModal";
import { glassPreview } from "@/components/design-system/primitives";
import { getExportIntentPreset, type ExportFormat } from "@/lib/export/prompts";
import { readLastOpenInProvider } from "@/lib/export/last-provider-storage";
import { cn } from "@/lib/utils";

function headingTokenStyle(scale: HeadingScale, key: keyof HeadingScale): CSSProperties {
  return {
    fontSize: `${scale[key].sizeRem}rem`,
    lineHeight: String(scale[key].lineHeight),
    letterSpacing: `${scale[key].trackingEm}em`,
    fontWeight: scale[key].weight,
  };
}

export function GlassFontsLab() {
  const [state, setState] = useState<GlassFontsBaselineState>(createDefaultGlassFontsBaselineState);
  const [hydrated, setHydrated] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    setState(loadGlassFontsBaselineState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveGlassFontsBaselineState(state);
  }, [hydrated, state]);

  const draftVariation = useMemo(
    () => buildFontVariationSettings(state.draftFamily, state.draftAxes[state.draftFamily]),
    [state.draftAxes, state.draftFamily]
  );
  const lockedVariation = useMemo(
    () => buildFontVariationSettings(state.lockedFamily, state.lockedAxes[state.lockedFamily]),
    [state.lockedAxes, state.lockedFamily]
  );

  const lockFontFamily = () => {
    setState((current) => ({
      ...current,
      lockedFamily: current.draftFamily,
      updatedAt: new Date().toISOString(),
    }));
  };

  const lockTypography = () => {
    setState((current) => ({
      ...current,
      lockedFamily: current.draftFamily,
      lockedAxes: {
        ...current.lockedAxes,
        [current.draftFamily]: { ...current.draftAxes[current.draftFamily] },
      },
      lockedHeadingScale: structuredClone(current.draftHeadingScale),
      updatedAt: new Date().toISOString(),
    }));
  };

  const updateAxis = (axis: AxisId, value: number) => {
    setState((current) => ({
      ...current,
      draftAxes: {
        ...current.draftAxes,
        [current.draftFamily]: {
          ...current.draftAxes[current.draftFamily],
          [axis]: value,
        },
      },
    }));
  };

  const updateHeading = (
    level: keyof HeadingScale,
    field: "sizeRem" | "lineHeight" | "trackingEm" | "weight",
    value: number
  ) => {
    setState((current) => ({
      ...current,
      draftHeadingScale: {
        ...current.draftHeadingScale,
        [level]: {
          ...current.draftHeadingScale[level],
          [field]: value,
        },
      },
    }));
  };

  const resetAxisToDefault = (axis: AxisId) => {
    const defaults = defaultAxisValuesForFamily(state.draftFamily);
    const fallback = defaults[axis];

    if (fallback === undefined) return;
    updateAxis(axis, fallback);
  };

  const revertAxisToLocked = (axis: AxisId) => {
    const locked = state.lockedAxes[state.draftFamily]?.[axis];
    const fallback = defaultAxisValuesForFamily(state.draftFamily)[axis];

    if (locked !== undefined) {
      updateAxis(axis, locked);

      return;
    }
    if (fallback !== undefined) updateAxis(axis, fallback);
  };

  const resetHeadingToDefault = (
    level: keyof HeadingScale,
    field: "sizeRem" | "lineHeight" | "trackingEm" | "weight"
  ) => {
    const fallback = DEFAULT_HEADING_SCALE[level][field];

    updateHeading(level, field, fallback);
  };

  const revertHeadingToLocked = (
    level: keyof HeadingScale,
    field: "sizeRem" | "lineHeight" | "trackingEm" | "weight"
  ) => {
    const fallback = state.lockedHeadingScale[level][field];

    updateHeading(level, field, fallback);
  };

  const reviewOutput = useMemo(() => {
    const headingRows = (Object.keys(state.draftHeadingScale) as Array<keyof HeadingScale>)
      .map((level) => {
        const token = state.draftHeadingScale[level];

        return `${level.toUpperCase()} size:${token.sizeRem}rem lh:${token.lineHeight} track:${token.trackingEm} weight:${token.weight}`;
      })
      .join("\n");

    const draftFamilyClass = familyClassName(state.draftFamily);
    const draftStyleLine = draftVariation
      ? `style={{ fontVariationSettings: '${draftVariation}' }}`
      : "style={{ fontVariationSettings: undefined }}";

    return `Glass Fonts Draft Baseline
family: ${familyDisplayName(state.draftFamily)} (${state.draftFamily})
className: ${draftFamilyClass}
${draftStyleLine}

tailwind (condensed):
${draftFamilyClass} text-[various] tracking-[custom] leading-[custom]

heading tokens:
${headingRows}`;
  }, [draftVariation, state.draftFamily, state.draftHeadingScale]);

  const exportReviewOutput = async (text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `glass-fonts-draft-${state.draftFamily}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const externalIntent = getExportIntentPreset("script-voiceover-chatgpt");

  const generateExternalPrompt = async (args: {
    intent: NonNullable<typeof externalIntent>;
    sourceText: string;
    userContext?: string;
    exportFormat: ExportFormat;
    provider?: string | null;
  }) => {
    const response = await fetch("/api/ai/export-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presetId: args.intent.id,
        exportFormat: args.exportFormat,
        sourceText: args.sourceText,
        userContext: args.userContext,
        provider:
          args.provider ??
          (args.exportFormat === "open_in_chat"
            ? (readLastOpenInProvider(args.intent.id) ?? undefined)
            : undefined),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate external prompt");
    }
    const data = (await response.json()) as { prompt?: string };

    if (!data.prompt) {
      throw new Error("Missing generated prompt");
    }

    return data.prompt;
  };

  return (
    <div
      className={cn("space-y-5", familyClassName(state.lockedFamily))}
      style={
        lockedVariation ? ({ fontVariationSettings: lockedVariation } as CSSProperties) : undefined
      }
    >
      <div
        className={cn(
          glassPreview({ depth: "raised", interactive: true, opaque: true }),
          "rounded-2xl border border-white/15 p-4 text-sm text-muted-foreground"
        )}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-accent/80">Baseline lock</p>
        <p className="mt-2">
          Locked family:{" "}
          <span className="text-foreground">{familyDisplayName(state.lockedFamily)}</span>
          {lockedVariation ? <span className="ml-2 text-xs">({lockedVariation})</span> : null}
        </p>
      </div>

      <Tabs className="w-full" defaultValue="font-options">
        <TabsList className="mb-4 h-auto gap-1 rounded-xl bg-background/45 p-1 backdrop-blur-sm">
          <TabsTrigger className="px-4 py-2" value="font-options">
            Font options
          </TabsTrigger>
          <TabsTrigger className="px-4 py-2" value="typography-axes">
            Typography & axes
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-0 space-y-4" value="font-options">
          <div
            className={cn(
              glassPreview({ depth: "raised", interactive: true, opaque: true }),
              "rounded-2xl border border-white/15 p-4"
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Draft family selection
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-sm text-muted-foreground" htmlFor="font-family-select">
                    Font family
                  </label>
                  <select
                    className="rounded-md border border-white/20 bg-background/55 px-3 py-2 text-sm text-foreground"
                    id="font-family-select"
                    value={state.draftFamily}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        draftFamily: event.currentTarget.value as FontFamilyId,
                      }))
                    }
                  >
                    {FONT_FAMILIES.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="rounded-full border border-accent/30 bg-accent/12 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-accent"
                type="button"
                onClick={lockFontFamily}
              >
                Lock font family
              </button>
            </div>
          </div>

          <FontComparisonGrid draftFamily={state.draftFamily} lockedFamily={state.lockedFamily} />
        </TabsContent>

        <TabsContent className="mt-0 space-y-4" value="typography-axes">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="self-start xl:sticky xl:top-6">
              <div
                className={cn(
                  glassPreview({ depth: "raised", interactive: true, opaque: true }),
                  familyClassName(state.draftFamily),
                  "rounded-2xl border border-white/15 p-4 sm:p-5"
                )}
                style={
                  draftVariation
                    ? ({ fontVariationSettings: draftVariation } as CSSProperties)
                    : undefined
                }
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-accent/80">
                    Draft preview
                  </p>
                  <button
                    className="rounded-full border border-white/25 bg-background/50 px-3 py-1 text-[10px] uppercase tracking-[0.13em] text-foreground"
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                  >
                    Review output
                  </button>
                </div>
                <p
                  className="mt-3 text-muted-foreground"
                  style={headingTokenStyle(state.draftHeadingScale, "overline")}
                >
                  Organic Glass typography
                </p>
                <h1
                  className="text-foreground"
                  style={headingTokenStyle(state.draftHeadingScale, "h1")}
                >
                  A chat surface that feels alive, calm, and precise.
                </h1>
                <h2
                  className="mt-4 text-foreground"
                  style={headingTokenStyle(state.draftHeadingScale, "h2")}
                >
                  Prototype heading level two
                </h2>
                <h3
                  className="mt-3 text-foreground"
                  style={headingTokenStyle(state.draftHeadingScale, "h3")}
                >
                  Supporting heading level three
                </h3>
                <p
                  className="mt-4 text-muted-foreground"
                  style={headingTokenStyle(state.draftHeadingScale, "body")}
                >
                  Adjusting axes and heading tokens here lets you test readability and character
                  before applying the change to the route baseline.
                </p>
              </div>
            </div>

            <TypographyStudio
              axisValues={state.draftAxes[state.draftFamily]}
              family={state.draftFamily}
              headingScale={state.draftHeadingScale}
              lockedAxisValues={state.lockedAxes[state.draftFamily]}
              lockedHeadingScale={state.lockedHeadingScale}
              onAxisChange={updateAxis}
              onAxisReset={resetAxisToDefault}
              onAxisRevert={revertAxisToLocked}
              onHeadingChange={updateHeading}
              onHeadingReset={resetHeadingToDefault}
              onHeadingRevert={revertHeadingToLocked}
              onLockTypography={lockTypography}
            />
          </div>
        </TabsContent>
      </Tabs>

      <TextCopyModal
        externalButtonLabel="Request Script from ChatGPT"
        externalIntent={externalIntent}
        description="Condensed export of the current draft family, variation settings, and heading tokens."
        exportLabel="Export"
        formatHint="condensed output"
        open={showReviewModal}
        text={reviewOutput}
        title="Draft typography output"
        generateExternalPrompt={
          externalIntent
            ? (payload) =>
                generateExternalPrompt({
                  intent: externalIntent,
                  sourceText: payload.sourceText,
                  userContext: payload.userContext,
                  exportFormat: payload.exportFormat,
                  provider: payload.provider,
                })
            : undefined
        }
        onExport={exportReviewOutput}
        onOpenChange={setShowReviewModal}
      />
    </div>
  );
}

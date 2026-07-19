"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, Layers } from "lucide-react";

import { StratumBetaBadge } from "./StratumBetaBadge";

import { glass } from "@/components/design-system/primitives";
import {
  stratumSpecToMarkdown,
  tryParseStratumSpecToolOutput,
  type StratumSpec,
  type StratumSpecFeature,
  type StratumSpecHandoff,
} from "@/lib/schemas/stratum";
import { cn } from "@/lib/utils";

const PRIORITY_ORDER: StratumSpecFeature["priority"][] = ["must", "should", "could"];

const PRIORITY_CHIP: Record<StratumSpecFeature["priority"], string> = {
  must: "border-foreground/40 text-foreground",
  should: "border-border text-muted-foreground",
  could: "border-border/50 text-muted-foreground/80",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/50 bg-background/30 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function HandoffRow({ handoff }: { handoff: StratumSpecHandoff }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/40 bg-background/25">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
          type="button"
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="truncate text-xs font-medium text-foreground">{handoff.title}</span>
          {handoff.target ? (
            <span className="shrink-0 text-[10px] text-muted-foreground/80">
              → {handoff.target}
            </span>
          ) : null}
        </button>
        <CopyButton label="Copy" text={handoff.body} />
      </div>
      {expanded ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap border-t border-border/40 px-2.5 py-2 text-[11px] leading-snug text-foreground/90">
          {handoff.body}
        </pre>
      ) : null}
    </div>
  );
}

function CoverageBar({ coverage }: { coverage: number }) {
  const clamped = Math.max(0, Math.min(100, coverage));

  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-background-tertiary/60">
        <div
          className="h-full rounded-full bg-foreground/50 transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {Math.round(clamped)}% mapped
      </span>
    </div>
  );
}

function FeatureList({ features }: { features: StratumSpec["features"] }) {
  return (
    <ul className="space-y-1.5">
      {PRIORITY_ORDER.flatMap((priority) =>
        features
          .filter((feature) => feature.priority === priority)
          .map((feature) => (
            <li key={feature.id} className="flex items-start gap-2 text-sm text-foreground">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
                  PRIORITY_CHIP[feature.priority]
                )}
              >
                {feature.priority}
              </span>
              <span className="min-w-0">
                {feature.title}
                {feature.detail ? (
                  <span className="text-xs text-muted-foreground"> — {feature.detail}</span>
                ) : null}
              </span>
            </li>
          ))
      )}
    </ul>
  );
}

/**
 * The living product spec sheet emitted by the `product_spec` tool — the model
 * re-emits the full spec as discovery uncovers more, replacing this view.
 */
export function StratumSpecToolResult({ output }: { output: unknown }) {
  const parsed = useMemo(() => tryParseStratumSpecToolOutput(output), [output]);

  if (!parsed) return null;
  const spec = parsed.spec;

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
          Product spec
        </span>
        <StratumBetaBadge />
        <span className="ml-auto">
          <CopyButton label="Copy as Markdown" text={stratumSpecToMarkdown(spec)} />
        </span>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-3 py-3">
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">{spec.name}</p>
          {spec.tagline ? (
            <p className="text-xs italic text-muted-foreground">{spec.tagline}</p>
          ) : null}
          {typeof spec.coverage === "number" ? <CoverageBar coverage={spec.coverage} /> : null}
          <p className="text-sm text-foreground/90">{spec.summary}</p>
        </div>

        {spec.problem ? (
          <div className="space-y-1">
            <SectionHeading>Problem</SectionHeading>
            <p className="text-sm text-foreground/90">{spec.problem}</p>
          </div>
        ) : null}

        {spec.audience.length > 0 ? (
          <div className="space-y-1.5">
            <SectionHeading>Audience</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              {spec.audience.map((audience) => (
                <span
                  key={audience}
                  className="rounded-full border border-border/50 bg-background/30 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {audience}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {spec.features.length > 0 ? (
          <div className="space-y-1.5">
            <SectionHeading>Features</SectionHeading>
            <FeatureList features={spec.features} />
          </div>
        ) : null}

        {spec.architecture ? (
          <div className="space-y-1.5">
            <SectionHeading>Architecture</SectionHeading>
            {spec.architecture.overview ? (
              <p className="text-sm text-foreground/90">{spec.architecture.overview}</p>
            ) : null}
            {spec.architecture.components.length > 0 ? (
              <ul className="space-y-1">
                {spec.architecture.components.map((component) => (
                  <li key={component.id} className="text-sm text-foreground">
                    <span className="font-medium">{component.name}</span>
                    <span className="text-xs text-muted-foreground"> — {component.role}</span>
                    {component.stack ? (
                      <span className="ml-1.5 rounded border border-border/40 px-1 py-px text-[10px] text-muted-foreground/80">
                        {component.stack}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {spec.architecture.dataFlows.length > 0 ? (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {spec.architecture.dataFlows.map((flow) => (
                  <li key={flow}>· {flow}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {spec.risks.length > 0 ? (
          <div className="space-y-1">
            <SectionHeading>Risks</SectionHeading>
            <ul className="space-y-0.5 text-sm text-foreground/90">
              {spec.risks.map((risk) => (
                <li key={risk}>· {risk}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {spec.openQuestions.length > 0 ? (
          <div className="space-y-1">
            <SectionHeading>Open questions</SectionHeading>
            <ul className="space-y-0.5 text-sm text-foreground/90">
              {spec.openQuestions.map((question) => (
                <li key={question}>· {question}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {spec.handoffs.length > 0 ? (
          <div className="space-y-1.5">
            <SectionHeading>Handoff chunks</SectionHeading>
            <p className="text-[11px] text-muted-foreground">
              Self-contained briefs to paste into Cursor, an agent, or a dev thread.
            </p>
            <div className="space-y-1.5">
              {spec.handoffs.map((handoff) => (
                <HandoffRow key={handoff.id} handoff={handoff} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

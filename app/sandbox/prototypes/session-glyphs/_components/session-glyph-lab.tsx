"use client";

import type { ReactNode } from "react";
import type { SessionExperience } from "@/lib/sidebar/session-experience";
import type { SessionSignal } from "@/lib/sidebar/session-signal";

import { useState } from "react";

import {
  PROPOSAL_EXPERIENCES,
  PROPOSALS,
  ProposalGlyph,
  type ProposalId,
} from "./proposal-shapes";

import { SessionGlyph } from "@/components/sidebar/session-glyph";
import { glass } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { SESSION_EXPERIENCES } from "@/lib/sidebar/session-experience";
import { cn } from "@/lib/utils";

type SignalKind = SessionSignal["kind"];

const SIGNAL_OPTIONS: { id: SignalKind; label: string; signal: SessionSignal }[] = [
  { id: "idle", label: "Idle", signal: { kind: "idle" } },
  { id: "working", label: "Working", signal: { kind: "working", step: "article" } },
  { id: "live", label: "Live", signal: { kind: "live" } },
  { id: "new", label: "New", signal: { kind: "new" } },
  { id: "paused", label: "Paused", signal: { kind: "paused" } },
];

const SHIPPED_EXPERIENCES: SessionExperience[] = [
  "chat",
  "arcadia",
  "speak",
  "rabbitHole",
  "strata",
  "remy",
  "noesis",
  "introspection",
  "other",
];

const SIZES = [
  { id: "row", label: "14px · row", className: "size-3.5" },
  { id: "inspect", label: "56px · inspect", className: "size-14" },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

const DEMO_TITLES: Record<string, string> = {
  chat: "Weekend trip ideas",
  arcadia: "Lab: packing list",
  speak: "Voice — kitchen timer",
  rabbitHole: "Why do cats purr?",
  strata: "Strata · travel notes",
  remy: "Thu meal plan",
  noesis: "Topic explore",
  introspection: "Weekly review",
  other: "Untitled session",
};

function SignalToggle({
  value,
  onChange,
}: {
  value: SignalKind;
  onChange: (next: SignalKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Signal state">
      {SIGNAL_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === option.id
              ? "bg-foreground text-background"
              : "bg-background-tertiary text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SizeToggle({ value, onChange }: { value: SizeId; onChange: (next: SizeId) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Glyph size">
      {SIZES.map((size) => (
        <button
          key={size.id}
          type="button"
          role="radio"
          aria-checked={value === size.id}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === size.id
              ? "bg-foreground text-background"
              : "bg-background-tertiary text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(size.id)}
        >
          {size.label}
        </button>
      ))}
    </div>
  );
}

function FakeSidebarRow({
  glyph,
  title,
  note,
}: {
  glyph: ReactNode;
  title: string;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50">
      {glyph}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{title}</p>
        {note ? <p className="truncate text-2xs text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  );
}

function GlyphCell({
  glyph,
  label,
  note,
  sizeClass,
}: {
  glyph: ReactNode;
  label: string;
  note?: string;
  sizeClass: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-border/40 bg-background-tertiary/40",
          sizeClass === "size-14" ? "h-24" : "h-14"
        )}
      >
        <span className={cn("text-foreground", sizeClass === "size-14" && "[&_svg]:size-14")}>
          {glyph}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {note ? <p className="text-2xs text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  );
}

export function SessionGlyphLab() {
  const [signalKind, setSignalKind] = useState<SignalKind>("idle");
  const [sizeId, setSizeId] = useState<SizeId>("row");
  const [compare, setCompare] = useState<ProposalId | "shipped">("mass");

  const signal = SIGNAL_OPTIONS.find((o) => o.id === signalKind)!.signal;
  const sizeClass = SIZES.find((s) => s.id === sizeId)!.className;
  const showRows = sizeId === "row";

  return (
    <Page>
      <PageContentFrame className="max-w-5xl">
        <PageNavBack className="mb-8" href="/sandbox/prototypes">
          ← Prototypes
        </PageNavBack>

        <header className="mb-8 space-y-3">
          <h1 className="font-commissioner text-3xl font-light tracking-tight text-foreground">
            Session glyphs
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Sidebar experience marks at production size. Chat and Arcadia share one treatment —
            in Mass they are the unmarked default (empty at idle). Compare optical weight,
            silhouette, and signal motion before promoting a set.
          </p>
        </header>

        <section className={cn("mb-8 space-y-4 rounded-xl p-4", glass())}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Signal
              </p>
              <SignalToggle value={signalKind} onChange={setSignalKind} />
            </div>
            <div className="space-y-2">
              <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Size
              </p>
              <SizeToggle value={sizeId} onChange={setSizeId} />
            </div>
          </div>
          <p className="text-2xs text-muted-foreground">
            Working uses rabbit-hole step <code className="text-foreground/80">article</code> so
            grow idioms light the middle part. Live drives Speak&apos;s level motion.
          </p>
        </section>

        {/* Shipped */}
        <section className="mb-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-medium text-foreground">Shipped</h2>
              <p className="text-xs text-muted-foreground">
                Production <code className="text-foreground/80">SessionGlyph</code> — Arcadia is
                still a separate arch mark; proposals unify it with Chat.
              </p>
            </div>
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-2xs font-medium",
                compare === "shipped"
                  ? "bg-accent/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setCompare("shipped")}
            >
              Pin for row compare
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {SHIPPED_EXPERIENCES.map((experience) => (
              <GlyphCell
                key={experience}
                label={SESSION_EXPERIENCES[experience].label}
                note={experience === "arcadia" ? "Diverges from chat" : undefined}
                sizeClass={sizeClass}
                glyph={
                  <SessionGlyph
                    className={sizeClass}
                    experience={experience}
                    signal={
                      experience === "rabbitHole" && signal.kind === "working"
                        ? signal
                        : experience === "speak" && signal.kind === "live"
                          ? signal
                          : signal.kind === "working" && experience !== "rabbitHole"
                            ? { kind: "working", step: null }
                            : signal
                    }
                  />
                }
              />
            ))}
          </div>
        </section>

        {/* Proposals */}
        {PROPOSALS.map((proposal) => (
          <section key={proposal.id} className="mb-12">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium text-foreground">{proposal.title}</h2>
                <p className="max-w-2xl text-xs text-muted-foreground">{proposal.pitch}</p>
              </div>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 text-2xs font-medium",
                  compare === proposal.id
                    ? "bg-accent/20 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setCompare(proposal.id)}
              >
                Pin for row compare
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {PROPOSAL_EXPERIENCES.map((item) => (
                <GlyphCell
                  key={`${proposal.id}-${item.id}`}
                  label={item.label}
                  note={item.note}
                  sizeClass={sizeClass}
                  glyph={
                    <ProposalGlyph
                      className={sizeClass}
                      experience={item.id}
                      proposal={proposal.id}
                      signal={
                        item.id === "rabbitHole" && signal.kind === "working"
                          ? signal
                          : item.id === "speak" && signal.kind === "live"
                            ? signal
                            : signal.kind === "working" && item.id !== "rabbitHole"
                              ? { kind: "working", step: null }
                              : signal
                      }
                    />
                  }
                />
              ))}
            </div>
          </section>
        ))}

        {/* Fake sidebar column */}
        <section className={cn("mb-8 rounded-xl p-4", glass())}>
          <h2 className="mb-1 text-lg font-medium text-foreground">Sidebar strip</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Pinned set at row density — how the column reads while scanning titles.
          </p>
          <div className="mx-auto max-w-xs rounded-lg border border-border/40 bg-background-tertiary/30 p-2">
            {compare === "shipped"
              ? SHIPPED_EXPERIENCES.filter((e) => e !== "arcadia").map((experience) => (
                  <FakeSidebarRow
                    key={experience}
                    title={DEMO_TITLES[experience] ?? experience}
                    note={SESSION_EXPERIENCES[experience].label}
                    glyph={
                      <SessionGlyph
                        experience={experience}
                        signal={
                          experience === "speak" && signal.kind === "live"
                            ? signal
                            : signal.kind === "working"
                              ? { kind: "working", step: experience === "rabbitHole" ? "article" : null }
                              : signal
                        }
                      />
                    }
                  />
                ))
              : PROPOSAL_EXPERIENCES.map((item) => (
                  <FakeSidebarRow
                    key={item.id}
                    title={DEMO_TITLES[item.id] ?? item.label}
                    note={item.label}
                    glyph={
                      <ProposalGlyph
                        experience={item.id}
                        proposal={compare}
                        signal={
                          item.id === "speak" && signal.kind === "live"
                            ? signal
                            : signal.kind === "working"
                              ? {
                                  kind: "working",
                                  step: item.id === "rabbitHole" ? "article" : null,
                                }
                              : signal
                        }
                      />
                    }
                  />
                ))}
          </div>
          {!showRows ? (
            <p className="mt-3 text-2xs text-muted-foreground">
              Switch size back to 14px · row for the densest reading of this strip.
            </p>
          ) : null}
        </section>
      </PageContentFrame>
    </Page>
  );
}

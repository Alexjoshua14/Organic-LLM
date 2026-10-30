"use client";

import { useCallback, useMemo, useState } from "react";

import { CAPSULE_FIXTURES } from "../_lib/fixtures";

import {
  LabPanel,
  PanelSection,
  ToggleRow,
} from "@/app/sandbox/prototypes/core-input/_components/lab-panel";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { CHAT_TITLE_SYSTEM } from "@/lib/llm/chat-title-system";
import {
  KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS,
  KNOWLEDGE_CAPSULE_SUMMARIZER_SYSTEM,
  KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS,
  KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
  parseKnowledgeCapsuleTitle,
  type KnowledgeCapsuleParseResult,
} from "@/lib/llm/knowledge-capsule-title-grammar";
import { cn } from "@/lib/utils";

const LAB_INTRO_SECTION_GAP_CLASS = "mb-4 sm:mb-6";

type LivePreview = {
  mode: "generate" | "parseOnly";
  capsule: KnowledgeCapsuleParseResult;
  legacyTitle?: string | null;
  error?: string;
};

export function KnowledgeCapsulesLab() {
  const [fixtureId, setFixtureId] = useState(CAPSULE_FIXTURES[0]?.id ?? "");
  const [summary, setSummary] = useState(CAPSULE_FIXTURES[0]?.summary ?? "");
  const [rawOutput, setRawOutput] = useState(CAPSULE_FIXTURES[0]?.rawModelOutput ?? "");
  const [includeLegacy, setIncludeLegacy] = useState(true);
  const [showPrompts, setShowPrompts] = useState(true);
  const [chrome, setChrome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LivePreview | null>(null);

  const fixture = useMemo(
    () => CAPSULE_FIXTURES.find((f) => f.id === fixtureId) ?? CAPSULE_FIXTURES[0],
    [fixtureId]
  );

  const offlineParse = useMemo(() => parseKnowledgeCapsuleTitle(rawOutput), [rawOutput]);

  const selectFixture = useCallback((id: string) => {
    const next = CAPSULE_FIXTURES.find((f) => f.id === id);
    if (!next) return;
    setFixtureId(id);
    setSummary(next.summary);
    setRawOutput(next.rawModelOutput);
    setLive(null);
  }, []);

  const runParseOnly = useCallback(async () => {
    setBusy(true);
    setLive(null);
    try {
      const res = await fetch("/api/prototypes/knowledge-capsules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summary || "parse-only",
          parseOnly: true,
          rawModelOutput: rawOutput,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        data?: LivePreview;
        error?: string;
      } | null;

      if (!res.ok) {
        setLive({
          mode: "parseOnly",
          capsule: offlineParse,
          error: body?.error ?? `HTTP ${res.status}`,
        });

        return;
      }

      setLive({
        mode: "parseOnly",
        capsule: body?.data?.capsule ?? offlineParse,
      });
    } catch (err) {
      setLive({
        mode: "parseOnly",
        capsule: offlineParse,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }, [offlineParse, rawOutput, summary]);

  const runGenerate = useCallback(async () => {
    setBusy(true);
    setLive(null);
    try {
      const res = await fetch("/api/prototypes/knowledge-capsules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, includeLegacy }),
      });
      const body = (await res.json().catch(() => null)) as {
        data?: {
          mode: "generate";
          capsule: KnowledgeCapsuleParseResult;
          legacyTitle?: string | null;
        };
        error?: string;
      } | null;

      if (!res.ok || !body?.data?.capsule) {
        setLive({
          mode: "generate",
          capsule: offlineParse,
          error: body?.error ?? `HTTP ${res.status}`,
        });

        return;
      }

      setLive({
        mode: "generate",
        capsule: body.data.capsule,
        legacyTitle: body.data.legacyTitle,
      });
      if (body.data.capsule.rawText) {
        setRawOutput(body.data.capsule.rawText);
      }
    } catch (err) {
      setLive({
        mode: "generate",
        capsule: offlineParse,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }, [includeLegacy, offlineParse, summary]);

  return (
    <Page
      className="items-stretch justify-start overflow-hidden"
      liquidChromeBackground={chrome}
      transparentBackground={chrome}
    >
      {chrome ? <AdaptiveLiquidChrome dimIntensity={0.45} /> : null}

      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-20">
        <PageContentFrame maxWidth="7xl">
          <PageNavBack className={LAB_INTRO_SECTION_GAP_CLASS} href="/sandbox/prototypes">
            ← Prototypes
          </PageNavBack>

          <header className={cn(LAB_INTRO_SECTION_GAP_CLASS, "max-w-3xl space-y-2")}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Knowledge capsules
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Developer bench for beta thread titles: dissect grammar slots, prompts, model
              output, validation, and the legacy short-title path. Toggle the setting under
              Settings → Appearance → Experimental.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-6">
              <GrammarCard />

              <section className={cn(glass({ border: "all" }), "space-y-3 rounded-2xl p-4")}>
                <h2 className="text-sm font-medium text-foreground">Sample summary</h2>
                <textarea
                  className="min-h-28 w-full resize-y rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                <h2 className="text-sm font-medium text-foreground">Raw model output</h2>
                <textarea
                  className="min-h-20 w-full resize-y rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={rawOutput}
                  onChange={(e) => setRawOutput(e.target.value)}
                />
                {fixture?.note ? (
                  <p className="text-2xs text-muted-foreground">{fixture.note}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                    disabled={busy || !summary.trim()}
                    type="button"
                    onClick={() => void runGenerate()}
                  >
                    {busy ? "Running…" : "Generate capsule (+ optional legacy)"}
                  </button>
                  <button
                    className="rounded-md border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
                    disabled={busy || !rawOutput.trim()}
                    type="button"
                    onClick={() => void runParseOnly()}
                  >
                    Parse raw only
                  </button>
                </div>
              </section>

              <ParseResultCard
                title="Offline parse (client)"
                result={offlineParse}
                legacyTitle={null}
              />

              {live ? (
                <ParseResultCard
                  title={live.mode === "generate" ? "Live generate" : "Live parse"}
                  result={live.capsule}
                  legacyTitle={live.legacyTitle ?? null}
                  error={live.error}
                />
              ) : null}

              {showPrompts ? (
                <section className="grid gap-4 md:grid-cols-2">
                  <PromptCard title="Capsule title system" body={KNOWLEDGE_CAPSULE_TITLE_SYSTEM} />
                  <PromptCard title="Legacy short-title system" body={CHAT_TITLE_SYSTEM} />
                  <PromptCard
                    title="Capsule summarizer"
                    body={KNOWLEDGE_CAPSULE_SUMMARIZER_SYSTEM}
                    className="md:col-span-2"
                  />
                </section>
              ) : null}
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <LabPanel>
                <PanelSection
                  hint="Pick a fixture to load summary + raw output."
                  title="Fixtures"
                >
                  <div className="flex flex-col gap-1">
                    {CAPSULE_FIXTURES.map((f) => (
                      <button
                        key={f.id}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          f.id === fixtureId
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        type="button"
                        onClick={() => selectFixture(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </PanelSection>

                <PanelSection title="Lab controls">
                  <ToggleRow
                    checked={includeLegacy}
                    label="Include legacy title"
                    hint="Side-by-side when generating"
                    onCheckedChange={setIncludeLegacy}
                  />
                  <ToggleRow
                    checked={showPrompts}
                    label="Show prompts"
                    onCheckedChange={setShowPrompts}
                  />
                  <ToggleRow
                    checked={chrome}
                    label="Liquid chrome backdrop"
                    onCheckedChange={setChrome}
                  />
                </PanelSection>

                <PanelSection title="What to watch">
                  <ul className="list-disc space-y-1.5 pl-4 text-2xs leading-relaxed text-muted-foreground">
                    <li>JSON slots vs freeform repair notes</li>
                    <li>Per-slot ≤{KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS} and combined ≤
                      {KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS} words</li>
                    <li>Where capsule and legacy diverge on the same summary</li>
                    <li>Low-signal fixtures (New chat / Quick chat)</li>
                  </ul>
                </PanelSection>
              </LabPanel>
            </aside>
          </div>
        </PageContentFrame>
      </div>
    </Page>
  );
}

function GrammarCard() {
  return (
    <section className={cn(glass({ border: "all" }), "rounded-2xl p-4")}>
      <h2 className="text-sm font-medium text-foreground">Grammar (initial)</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Spirit is ~4 words; the explicit combined cap is{" "}
        <span className="text-foreground">{KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS} words</span>.
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          ["action", "up to 2 words"],
          ["subject", "up to 2 words"],
          ["additional", "up to 2 words"],
        ].map(([slot, rule]) => (
          <div key={slot} className="rounded-lg bg-muted/40 px-3 py-2">
            <dt className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {slot}
            </dt>
            <dd className="mt-0.5 text-xs text-foreground">{rule}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ParseResultCard({
  title,
  result,
  legacyTitle,
  error,
}: {
  title: string;
  result: KnowledgeCapsuleParseResult;
  legacyTitle: string | null;
  error?: string;
}) {
  return (
    <section className={cn(glass({ border: "all" }), "space-y-3 rounded-2xl p-4")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <StatusPill status={result.status} />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="rounded-lg bg-muted/40 px-3 py-2">
        <div className="text-2xs uppercase tracking-[0.14em] text-muted-foreground">Title</div>
        <div className="mt-0.5 text-base font-medium text-foreground">
          {result.title || "—"}
        </div>
        <div className="mt-1 text-2xs text-muted-foreground">
          {result.wordCount} / {KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS} words
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["action", result.slots.action],
            ["subject", result.slots.subject],
            ["additional", result.slots.additional],
          ] as const
        ).map(([slot, value]) => (
          <div key={slot} className="rounded-lg border border-border/50 px-3 py-2">
            <div className="text-2xs uppercase tracking-[0.14em] text-muted-foreground">{slot}</div>
            <div className="mt-0.5 font-mono text-xs text-foreground">{value || "∅"}</div>
          </div>
        ))}
      </div>
      {legacyTitle != null ? (
        <div className="rounded-lg border border-dashed border-border/60 px-3 py-2">
          <div className="text-2xs uppercase tracking-[0.14em] text-muted-foreground">
            Legacy short title
          </div>
          <div className="mt-0.5 text-sm text-foreground">{legacyTitle || "—"}</div>
        </div>
      ) : null}
      {result.notes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-2xs text-muted-foreground">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {result.rawText ? (
        <pre className="overflow-x-auto rounded-lg bg-muted/30 p-2 font-mono text-2xs text-muted-foreground">
          {result.rawText}
        </pre>
      ) : null}
    </section>
  );
}

function StatusPill({ status }: { status: KnowledgeCapsuleParseResult["status"] }) {
  const tone =
    status === "ok"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "repaired"
        ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
        : "bg-destructive/15 text-destructive";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-2xs font-medium uppercase", tone)}>
      {status}
    </span>
  );
}

function PromptCard({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <section className={cn(glass({ border: "all" }), "rounded-2xl p-4", className)}>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-3 font-mono text-2xs leading-relaxed text-muted-foreground">
        {body}
      </pre>
    </section>
  );
}

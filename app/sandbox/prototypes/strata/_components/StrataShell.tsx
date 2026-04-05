"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";

import { motion } from "framer-motion";

import { saveStrataGeneratedSectionsAction, saveStrataSectionAction } from "../actions";

import { SectionCard } from "./SectionCard";
import { ChatLoading, ChatThinking } from "@/components/chat/chat-loading";

import {
  StrataGenerateResponseSchema,
  type StrataGenerationContext,
  type StrataPageWithSections,
  type StrataSectionKey,
} from "@/lib/schemas/strata";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import {
  getLocalOnlyMode,
  getLocalStrataPage,
  saveLocalStrataPage,
  setLocalOnlyMode,
} from "@/lib/strata/local-store";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";

type ActionStatusState = "idle" | "loading" | "completed" | "error";
const NOTEBOOK_FOCUS_CLASS =
  "focus:bg-[linear-gradient(to_bottom,transparent_31px,rgba(120,120,120,0.12)_32px)] focus:bg-size-[100%_32px]";

function getSectionLabels(): Record<StrataSectionKey, { title: string; subtitle: string }> {
  return {
    raw_text: {
      title: "Raw Text",
      subtitle: "Your source input. AI does not rewrite this section.",
    },
    refined_text: {
      title: "Refined Text",
      subtitle: "Near 1:1 cleanup from Raw Text with formatting consistency.",
    },
    elaborated: {
      title: "Elaborated",
      subtitle: "Expanded representation using the refined content.",
    },
    design_instructions: {
      title: "Design Instructions",
      subtitle: "Visual and structure guidance used by Strata generation.",
    },
    ai_instructions: {
      title: "AI Instructions",
      subtitle: "Behavior instructions for the Strata generation pipeline.",
    },
  };
}

function buildRefinedSectionTitle(refinedText: string): string {
  const cleaned = refinedText.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return "Refined Draft";
  return cleaned.split(" ").filter(Boolean).slice(0, 8).join(" ");
}

export function StrataShell({
  initialData,
  dbAvailable,
}: {
  initialData: StrataPageWithSections;
  dbAvailable: boolean;
}) {
  const [pageData, setPageData] = useState(initialData.page);
  const [sections, setSections] = useState(initialData.sections);
  const [actionStatus, setActionStatus] = useState<{
    state: ActionStatusState;
    text: string;
  }>({ state: "idle", text: "" });
  const [overwriteElaborated, setOverwriteElaborated] = useState(false);
  const [localOnlyMode, setLocalOnlyModeState] = useState(!dbAvailable);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const rawRef = useRef<HTMLElement | null>(null);
  const refinedRef = useRef<HTMLElement | null>(null);
  const elaboratedRef = useRef<HTMLElement | null>(null);
  const designRef = useRef<HTMLElement | null>(null);
  const aiRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showStickyGenerate, setShowStickyGenerate] = useState(true);

  const labels = useMemo(() => getSectionLabels(), []);
  const refinedSectionTitle = useMemo(
    () =>
      buildRefinedSectionTitle(
        ((sections.refined_text.contentJson as { generatedTitle?: string } | null)?.generatedTitle ??
          "")
      ),
    [sections.refined_text.contentJson]
  );

  useEffect(() => {
    if (actionStatus.state !== "completed") return;
    const timer = setTimeout(() => {
      setActionStatus({ state: "idle", text: "" });
    }, 15_000);

    return () => clearTimeout(timer);
  }, [actionStatus.state]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const localSnapshot = await getLocalStrataPage(initialData.page.id);
      const persistedLocalOnly = getLocalOnlyMode(initialData.page.id);

      if (cancelled) return;
      if (localSnapshot) {
        setPageData(localSnapshot.page);
        setSections(localSnapshot.sections);
      } else {
        await saveLocalStrataPage(initialData);
      }

      if (!dbAvailable) {
        setLocalOnlyMode(initialData.page.id, true);
        setLocalOnlyModeState(true);
      } else {
        setLocalOnlyModeState(persistedLocalOnly);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dbAvailable, initialData]);

  useEffect(() => {
    const rawEl = rawRef.current;
    const refinedEl = refinedRef.current;

    if (!rawEl || !refinedEl) return;

    const inView = {
      raw: true,
      refined: true,
    };

    const updateVisibility = () => {
      setShowStickyGenerate(inView.raw || inView.refined);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === rawEl) inView.raw = entry.isIntersecting;
          if (entry.target === refinedEl) inView.refined = entry.isIntersecting;
        }
        updateVisibility();
      },
      { threshold: 0.25 }
    );

    observer.observe(rawEl);
    observer.observe(refinedEl);

    return () => observer.disconnect();
  }, []);

  const mode = useMemo(() => {
    const hasRefined = sections.refined_text.content.trim().length > 0;
    const hasElaborated = sections.elaborated.content.trim().length > 0;

    return hasRefined && hasElaborated ? "update" : "create";
  }, [sections.elaborated.content, sections.refined_text.content]);

  const saveSection = (sectionKey: StrataSectionKey, content: string) => {
    setActionStatus({
      state: "loading",
      text: localOnlyMode || !dbAvailable ? "Saving locally" : "Saving section",
    });
    startTransition(async () => {
      try {
        const safeContent = sectionKey === "raw_text" ? sanitizeRawUserInput(content) : content;

        const nextSections = {
          ...sections,
          [sectionKey]: {
            ...sections[sectionKey],
            content: safeContent,
          },
        };

        if (!localOnlyMode && dbAvailable) {
          await saveStrataSectionAction({
            pageId: initialData.page.id,
            ownerId: initialData.page.owner_id,
            sectionKey,
            content: safeContent,
          });
        }

        await saveLocalStrataPage({
          page: pageData,
          sections: nextSections,
        });

        let completedText =
          !localOnlyMode && dbAvailable
            ? "Saved to Supabase + encrypted local device storage."
            : "Saved to encrypted local device storage (ZDR).";

        if (sectionKey === "raw_text" && safeContent !== content) {
          completedText =
            "Raw text saved with safety sanitization to protect against XSS and prompt injection.";
        }
        setActionStatus({ state: "completed", text: completedText });
      } catch (err) {
        setActionStatus({
          state: "error",
          text: err instanceof Error ? err.message : "Failed to save",
        });
      }
    });
  };

  const runGenerate = async () => {
    setIsGenerating(true);
    setActionStatus({
      state: "loading",
      text: mode === "create" ? "Creating sections" : "Updating sections",
    });

    try {
      // Route performs memory and knowledge-graph tool calls before final output.
      setActionStatus({
        state: "loading",
        text: "Searching memories...",
      });

      const res = await fetch("/api/prototypes/strata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: !localOnlyMode && dbAvailable ? initialData.page.id : undefined,
          mode,
          sectionsSnapshot: {
            raw_text: sanitizeRawUserInput(sections.raw_text.content),
            refined_text: sections.refined_text.content,
            elaborated: sections.elaborated.content,
            design_instructions: sections.design_instructions.content,
            ai_instructions: sections.ai_instructions.content,
          },
          rawGenerationMetadata: {
            generationContext:
              ((sections.raw_text.contentJson as { generationContext?: StrataGenerationContext } | null)
                ?.generationContext ??
                undefined),
          },
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        const message =
          typeof payload?.error === "string" ? payload.error : "Failed to generate Strata content";

        throw new Error(message);
      }

      const parsed = StrataGenerateResponseSchema.parse(payload);

      if (!localOnlyMode && dbAvailable) {
        await saveStrataGeneratedSectionsAction({
          pageId: initialData.page.id,
          ownerId: initialData.page.owner_id,
          existing: sections,
          refinedTitle: parsed.refinedTitle,
          refinedText: parsed.refinedText,
          elaborated: parsed.elaborated,
          elaboratedArtifacts: parsed.elaboratedArtifacts,
          overwriteElaborated,
          rawGenerationContext: parsed.rawGenerationContext,
        });
      }

      const shouldOverwriteElaborated =
        overwriteElaborated || sections.elaborated.content.trim().length === 0;

      const nextSections = {
        ...sections,
        raw_text: {
          ...sections.raw_text,
          contentJson: parsed.rawGenerationContext
            ? {
              ...((sections.raw_text.contentJson ?? {}) as Record<string, unknown>),
              generationContext: parsed.rawGenerationContext,
            }
            : sections.raw_text.contentJson,
        },
        refined_text: {
          ...sections.refined_text,
          content: parsed.refinedText,
          contentJson: {
            ...((sections.refined_text.contentJson ?? {}) as Record<string, unknown>),
            generatedTitle: parsed.refinedTitle,
          },
        },
        elaborated: shouldOverwriteElaborated
          ? {
            ...sections.elaborated,
            content: parsed.elaborated,
            contentJson: parsed.elaboratedArtifacts ?? null,
          }
          : sections.elaborated,
      };

      setSections(nextSections);
      await saveLocalStrataPage({
        page: pageData,
        sections: nextSections,
      });
      const completedText =
        localOnlyMode || !dbAvailable
          ? mode === "create"
            ? "Created sections and saved locally (ZDR)."
            : "Updated sections and saved locally (ZDR)."
          : mode === "create"
            ? "Created sections and synced to Supabase + local encrypted backup."
            : "Updated sections and synced to Supabase + local encrypted backup.";

      setActionStatus({ state: "completed", text: completedText });
    } catch (err) {
      setActionStatus({
        state: "error",
        text: err instanceof Error ? err.message : "Generation failed",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
      <div className="mx-auto w-[97vw] max-w-3xl px-3 pt-8 sm:w-[90vw] sm:px-6">
        <nav className="mb-6">
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/sandbox/prototypes/strata"
          >
            ← Strata pages
          </Link>
        </nav>

        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {pageData.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Raw -&gt; Refined -&gt; Elaborated with instruction-bound generation.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {localOnlyMode ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                ZDR compliant - local-only encrypted storage
              </span>
            ) : (
              <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                Sync mode - Supabase + encrypted local backup
              </span>
            )}
            {!dbAvailable && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
                Supabase unavailable: local fallback active
              </span>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              checked={localOnlyMode}
              disabled={!dbAvailable}
              type="checkbox"
              onChange={(e) => {
                const enabled = e.target.checked;

                setLocalOnlyMode(initialData.page.id, enabled);
                setLocalOnlyModeState(enabled);
                setActionStatus({
                  state: "completed",
                  text: enabled
                    ? "Local-only mode enabled for this page (ZDR)."
                    : "Local-only mode disabled for this page.",
                });
              }}
            />
            Local-only mode for this page (ZDR)
          </label>
        </header>
      </div>

      {showStickyGenerate && (
        <div className="pointer-events-none absolute right-3 top-28 z-30 sm:right-6">
          <div
            className={cn(
              glass({ opaque: true }),
              "pointer-events-auto flex items-center gap-3 rounded-full border px-3 py-2 shadow-lg"
            )}
          >
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                checked={overwriteElaborated}
                type="checkbox"
                onChange={(e) => setOverwriteElaborated(e.target.checked)}
              />
              Overwrite Elaborated
            </label>
            <button
              data-dim-background
              className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={isGenerating}
              type="button"
              onClick={runGenerate}
            >
              {isGenerating
                ? "Working..."
                : mode === "create"
                  ? "Create Sections"
                  : "Update Sections"}
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 w-full overflow-y-auto overscroll-y-contain"
      >
        <div className="mx-auto w-[97vw] max-w-3xl space-y-4 px-3 pb-6 sm:w-[90vw] sm:px-6">
          <SectionCard
            sectionRef={rawRef}
            subtitle={labels.raw_text.subtitle}
            title={labels.raw_text.title}
            variant="notes"
          >
            <div className="flex h-full flex-col gap-3">
              <textarea
                data-dim-background="full"
                className={cn(
                  glass(),
                  "min-h-[44dvh] w-full flex-1 resize-y rounded-lg border border-border/70 p-5",
                  "focus:bg-background-tertiary/75 dark:focus:bg-background-tertiary/75",
                  "text-[15px] leading-7 text-foreground font-normal",
                  "shadow-inner transition-[background-image,background-size] duration-200",
                  NOTEBOOK_FOCUS_CLASS
                )}
                value={sections.raw_text.content}
                onChange={(e) =>
                  setSections((prev) => ({
                    ...prev,
                    raw_text: { ...prev.raw_text, content: e.target.value },
                  }))
                }
              />
              <div className="flex items-center justify-between">
                <button
                  className={cn(
                    glass({ opaque: true }),
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                  )}
                  type="button"
                  onClick={() => saveSection("raw_text", sections.raw_text.content)}
                >
                  Save Raw Text
                </button>
                <p className="text-xs text-muted-foreground">
                  Source-of-truth input for generation.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            sectionRef={refinedRef}
            subtitle={labels.refined_text.subtitle}
            title={labels.refined_text.title}
            variant="editorial"
          >
            <article
              className={cn("mx-auto min-h-[44dvh] w-full max-w-2xl whitespace-pre-wrap px-1 py-4")}
            >
              <div className="space-y-5 text-foreground">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  {refinedSectionTitle}
                </p>
                <div className="font-serif text-[19px] leading-9 sm:text-[21px]">
                  {sections.refined_text.content || "No refined content yet."}
                </div>
              </div>
            </article>
          </SectionCard>

          <motion.section
            ref={elaboratedRef}
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
              "min-h-[88dvh] rounded-xl px-4 py-6 sm:px-6 sm:py-8",
              glass({ tone: "brown" }),
              "border border-border/60 backdrop-blur-xl"
            )}
          >
            <header className="mb-6 space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {labels.elaborated.title}
              </h2>
              <p className="text-sm text-muted-foreground">{labels.elaborated.subtitle}</p>
            </header>
            <article className="prose prose-neutral dark:prose-invert max-w-none text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {sections.elaborated.content || "No elaborated content yet."}
              </ReactMarkdown>
            </article>
          </motion.section>

          <SectionCard
            sectionRef={designRef}
            subtitle={labels.design_instructions.subtitle}
            title={labels.design_instructions.title}
            variant="system"
            className="min-h-[56dvh]"
          >
            <div className="flex h-full flex-col gap-3">
              <textarea
                data-dim-background="full"
                className={cn(
                  "min-h-[30dvh] w-full flex-1 resize-y rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-6 text-muted-foreground",
                  NOTEBOOK_FOCUS_CLASS
                )}
                value={sections.design_instructions.content}
                onChange={(e) =>
                  setSections((prev) => ({
                    ...prev,
                    design_instructions: { ...prev.design_instructions, content: e.target.value },
                  }))
                }
              />
              <button
                className={cn(
                  glass({ opaque: true }),
                  "w-fit rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                )}
                type="button"
                onClick={() =>
                  saveSection("design_instructions", sections.design_instructions.content)
                }
              >
                Save Design Instructions
              </button>
            </div>
          </SectionCard>

          <SectionCard
            sectionRef={aiRef}
            subtitle={labels.ai_instructions.subtitle}
            title={labels.ai_instructions.title}
            variant="system"
            className="min-h-[56dvh]"
          >
            <div className="flex h-full flex-col gap-3">
              <textarea
                data-dim-background="full"
                className={cn(
                  "min-h-[30dvh] w-full flex-1 resize-y rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-6 text-muted-foreground",
                  NOTEBOOK_FOCUS_CLASS
                )}
                value={sections.ai_instructions.content}
                onChange={(e) =>
                  setSections((prev) => ({
                    ...prev,
                    ai_instructions: { ...prev.ai_instructions, content: e.target.value },
                  }))
                }
              />
              <button
                className={cn(
                  glass({ opaque: true }),
                  "w-fit rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                )}
                type="button"
                onClick={() => saveSection("ai_instructions", sections.ai_instructions.content)}
              >
                Save AI Instructions
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      <footer className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-xs sm:px-6">
        {actionStatus.state !== "idle" ? (
          <div
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
              actionStatus.state === "loading" && "border-border/50 bg-muted/20",
              actionStatus.state === "completed" &&
              "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
              actionStatus.state === "error" &&
              "border-destructive/40 bg-destructive/10 text-destructive"
            )}
          >
            <span
              className={cn(
                "text-xs",
                actionStatus.state === "loading" &&
                "animate-pulse bg-linear-to-r from-muted-foreground/70 via-foreground/80 to-muted-foreground/70 bg-clip-text text-transparent"
              )}
            >
              {actionStatus.text}
            </span>
            {actionStatus.state === "completed" && (
              <button
                aria-label="Dismiss status"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300"
                type="button"
                onClick={() => setActionStatus({ state: "idle", text: "" })}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground" />
        )}
        {(actionStatus.state === "loading" || isPending || isGenerating) && (
          <div className="w-16 text-muted-foreground">
            <ChatThinking text="Working..." />
          </div>
        )}
      </footer>
    </div>
  );
}

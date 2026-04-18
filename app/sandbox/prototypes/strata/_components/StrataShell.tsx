"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";

import { motion } from "framer-motion";

import { saveStrataGeneratedSectionsAction, saveStrataSectionAction } from "../actions";

import { SectionCard } from "./SectionCard";
import { StrataAssistantOpenHint } from "./StrataWorkspace";
import { StrataElaboratedTTSBar } from "./StrataElaboratedTTSBar";
import { ChatThinking } from "@/components/chat/chat-loading";

import {
  StrataGenerateResponseSchema,
  isUntitledStrataTitle,
  type StrataGenerationContext,
  type StrataPageWithSections,
  type StrataSectionKey,
} from "@/lib/schemas/strata";
// Glass: full variant docs (tone, opaque, border) on `glass` in components/design-system/primitives.ts
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import {
  getLocalOnlyMode,
  getLocalStrataPage,
  saveLocalStrataPage,
  setLocalOnlyMode,
} from "@/lib/strata/local-store";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { buildElaboratedContentJsonAfterModel } from "@/lib/strata/elaborated-tts";

type ActionStatusState = "idle" | "loading" | "completed" | "error";
type StrataMainTab = "source" | "synthesis" | "settings";
type SourceSaveState = "idle" | "saving" | "saved" | "error";
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
  const router = useRouter();

  const elaboratedRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rawSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<StrataMainTab>("source");
  const [showRefinedPreview, setShowRefinedPreview] = useState(false);
  const [sourceSave, setSourceSave] = useState<{
    state: SourceSaveState;
    at?: number;
    message?: string;
  }>({ state: "idle" });

  const sectionsRef = useRef(sections);
  const pageDataRef = useRef(pageData);
  sectionsRef.current = sections;
  pageDataRef.current = pageData;

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
    return () => {
      if (rawSaveTimerRef.current) clearTimeout(rawSaveTimerRef.current);
    };
  }, []);

  const mode = useMemo(() => {
    const hasRefined = sections.refined_text.content.trim().length > 0;
    const hasElaborated = sections.elaborated.content.trim().length > 0;

    return hasRefined && hasElaborated ? "update" : "create";
  }, [sections.elaborated.content, sections.refined_text.content]);

  const saveSection = (
    sectionKey: StrataSectionKey,
    content: string,
    opts?: { autosaveRaw?: boolean }
  ) => {
    const isAutosaveRaw = Boolean(opts?.autosaveRaw && sectionKey === "raw_text");
    if (isAutosaveRaw) {
      setSourceSave({ state: "saving", at: Date.now() });
    } else {
      setActionStatus({
        state: "loading",
        text: localOnlyMode || !dbAvailable ? "Saving locally" : "Saving section",
      });
    }
    startTransition(async () => {
      try {
        const safeContent = sectionKey === "raw_text" ? sanitizeRawUserInput(content) : content;
        const prevSections = sectionsRef.current;
        const currentPage = pageDataRef.current;

        const nextSections = {
          ...prevSections,
          [sectionKey]: {
            ...prevSections[sectionKey],
            content: safeContent,
          },
        };

        if (!localOnlyMode && dbAvailable) {
          await saveStrataSectionAction({
            pageId: initialData.page.id,
            ownerId: initialData.page.owner_id,
            sectionKey,
            content: safeContent,
            contentJson: nextSections[sectionKey].contentJson ?? null,
          });
        }

        await saveLocalStrataPage({
          page: currentPage,
          sections: nextSections,
        });

        if (isAutosaveRaw) {
          setSections(nextSections);
          sectionsRef.current = nextSections;
          setSourceSave({
            state: "saved",
            at: Date.now(),
            message:
              safeContent !== content
                ? "Saved (sanitized for safety)"
                : !localOnlyMode && dbAvailable
                  ? "Saved"
                  : "Saved locally",
          });
          return;
        }

        setSections(nextSections);
        sectionsRef.current = nextSections;

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
        const msg = err instanceof Error ? err.message : "Failed to save";
        if (isAutosaveRaw) {
          setSourceSave({ state: "error", at: Date.now(), message: msg });
        } else {
          setActionStatus({
            state: "error",
            text: msg,
          });
        }
      }
    });
  };

  const queueRawAutosave = useCallback(() => {
    if (rawSaveTimerRef.current) clearTimeout(rawSaveTimerRef.current);
    setSourceSave((prev) => (prev.state === "error" ? prev : { state: "saving", at: Date.now() }));
    rawSaveTimerRef.current = setTimeout(() => {
      rawSaveTimerRef.current = null;
      saveSection("raw_text", sectionsRef.current.raw_text.content, { autosaveRaw: true });
    }, 1200);
  }, [saveSection]);

  const persistElaboratedContentJson = async (nextContentJson: Record<string, unknown> | null) => {
    setActionStatus({
      state: "loading",
      text: localOnlyMode || !dbAvailable ? "Saving narration locally" : "Saving narration",
    });
    try {
      let nextSections: typeof sections | undefined;
      setSections((prev) => {
        nextSections = {
          ...prev,
          elaborated: { ...prev.elaborated, contentJson: nextContentJson },
        };
        return nextSections;
      });
      if (!nextSections) {
        throw new Error("Failed to update elaborated section state.");
      }

      if (!localOnlyMode && dbAvailable) {
        await saveStrataSectionAction({
          pageId: initialData.page.id,
          ownerId: initialData.page.owner_id,
          sectionKey: "elaborated",
          content: nextSections.elaborated.content,
          contentJson: nextContentJson,
        });
      }

      await saveLocalStrataPage({
        page: pageData,
        sections: nextSections,
      });

      setActionStatus({
        state: "completed",
        text:
          !localOnlyMode && dbAvailable
            ? "Narration saved to Supabase + local backup."
            : "Narration saved to encrypted local storage.",
      });
    } catch (err) {
      setActionStatus({
        state: "error",
        text: err instanceof Error ? err.message : "Failed to save narration",
      });
      throw err;
    }
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
            contentJson: buildElaboratedContentJsonAfterModel(parsed.elaboratedArtifacts),
          }
          : sections.elaborated,
      };

      let nextPageTitle = pageData.title;
      if (isUntitledStrataTitle(pageData.title)) {
        try {
          const titleRes = await fetch(
            `/api/prototypes/strata/${initialData.page.id}/generate-title`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sectionsSnapshot: {
                  raw_text: sanitizeRawUserInput(sections.raw_text.content),
                  refined_text: parsed.refinedText,
                  elaborated: parsed.elaborated,
                  design_instructions: sections.design_instructions.content,
                  ai_instructions: sections.ai_instructions.content,
                },
                refinedGeneratedTitle: parsed.refinedTitle,
                applyToDatabase: !localOnlyMode && dbAvailable,
              }),
            }
          );
          const titlePayload = await titleRes.json();
          if (titleRes.ok && typeof titlePayload?.data === "string" && titlePayload.data.trim()) {
            nextPageTitle = titlePayload.data.trim();
          }
        } catch {
          /* title generation is best-effort */
        }
      }

      const nextPage = { ...pageData, title: nextPageTitle };

      setSections(nextSections);
      setPageData(nextPage);
      await saveLocalStrataPage({
        page: nextPage,
        sections: nextSections,
      });

      if (!localOnlyMode && dbAvailable) {
        router.refresh();
      }

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

  const sourceSaveLabel = useMemo(() => {
    if (sourceSave.state === "idle") return null;
    if (sourceSave.state === "saving") return "Saving…";
    if (sourceSave.state === "error") return sourceSave.message ?? "Error";
    if (sourceSave.state === "saved" && sourceSave.at) {
      const t = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(sourceSave.at));
      return `${sourceSave.message ?? "Saved"} · ${t}`;
    }
    return sourceSave.message ?? "Saved";
  }, [sourceSave]);

  const flushSaveRaw = () => {
    if (rawSaveTimerRef.current) {
      clearTimeout(rawSaveTimerRef.current);
      rawSaveTimerRef.current = null;
    }
    saveSection("raw_text", sectionsRef.current.raw_text.content);
  };

  const tabDefs: { id: StrataMainTab; label: string }[] = [
    { id: "source", label: "Source" },
    { id: "synthesis", label: "Synthesis" },
    { id: "settings", label: "Settings" },
  ];

  const showGenerationStrip = activeTab === "source" || activeTab === "synthesis";

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-5xl shrink-0 px-6 pt-6 sm:pt-8">
        <nav className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground select-none"
            href="/sandbox/prototypes/strata"
          >
            ← Strata pages
          </Link>
          <StrataAssistantOpenHint />
        </nav>

        <header className="mb-4 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-3xl">
              {pageData.title}
            </h1>
            {activeTab === "source" && sourceSaveLabel ? (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs tabular-nums",
                  sourceSave.state === "saving" && "border-border/60 bg-muted/30 text-muted-foreground",
                  sourceSave.state === "saved" && "border-emerald-500/35 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
                  sourceSave.state === "error" && "border-destructive/40 bg-destructive/10 text-destructive"
                )}
                role="status"
              >
                {sourceSaveLabel}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Autosave keeps your Source safe. Elaboration runs only when you choose Generate in Synthesis.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {localOnlyMode ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                ZDR compliant — local-only encrypted storage
              </span>
            ) : (
              <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                Sync mode — Supabase + encrypted local backup
              </span>
            )}
            {!dbAvailable && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
                Supabase unavailable: local fallback active
              </span>
            )}
          </div>
        </header>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-6 pb-1">
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-3"
        >
          {activeTab === "source" ? (
            <div className="space-y-4 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{labels.raw_text.subtitle}</p>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    checked={showRefinedPreview}
                    type="checkbox"
                    onChange={(e) => setShowRefinedPreview(e.target.checked)}
                  />
                  Refined preview
                </label>
              </div>
              <div className={cn("grid gap-4", showRefinedPreview ? "lg:grid-cols-2" : "grid-cols-1")}>
                <textarea
                  data-dim-background="full"
                  className={cn(
                    glass(),
                    "min-h-[min(52dvh,28rem)] w-full resize-y rounded-lg border border-border/70 p-5",
                    "focus:bg-background-tertiary/75 dark:focus:bg-background-tertiary/75",
                    "text-[15px] leading-7 text-foreground font-normal",
                    "shadow-inner transition-[background-image,background-size] duration-200",
                    NOTEBOOK_FOCUS_CLASS
                  )}
                  value={sections.raw_text.content}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSections((prev) => ({
                      ...prev,
                      raw_text: { ...prev.raw_text, content: v },
                    }));
                    queueRawAutosave();
                  }}
                />
                {showRefinedPreview ? (
                  <div
                    className={cn(
                      glass({ opaque: true }),
                      "min-h-[min(52dvh,28rem)] overflow-y-auto rounded-lg border border-border/60 p-5"
                    )}
                  >
                    <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      {refinedSectionTitle}
                    </p>
                    <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-7">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {sections.refined_text.content ||
                          "_No refined preview yet. Use **Generate** in Synthesis after saving source._"}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  className={cn(
                    glass({ opaque: true }),
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                  )}
                  type="button"
                  onClick={flushSaveRaw}
                >
                  Save now
                </button>
                <p className="text-xs text-muted-foreground">Edits also save automatically after you pause typing.</p>
              </div>
            </div>
          ) : null}

          {activeTab === "synthesis" ? (
            <motion.section
              ref={elaboratedRef}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              initial={{ opacity: 0, y: 16, scale: 0.99 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={cn(
                "min-h-[min(70dvh,36rem)] rounded-xl px-4 py-6 sm:px-6 sm:py-8",
                glass({ tone: "brown", opaque: true }),
                "border border-border/60 backdrop-blur-xl"
              )}
            >
              <header className="mb-4 space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {labels.elaborated.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {labels.elaborated.subtitle} Generation runs only when you press the button below — not while you
                  type.
                </p>
              </header>
              <StrataElaboratedTTSBar
                contentJson={sections.elaborated.contentJson}
                disabled={isGenerating}
                markdown={sections.elaborated.content}
                onPersist={persistElaboratedContentJson}
              />
              <article className="prose prose-neutral dark:prose-invert max-w-none text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {sections.elaborated.content || "No elaborated content yet."}
                </ReactMarkdown>
              </article>
            </motion.section>
          ) : null}

          {activeTab === "settings" ? (
            <div className="space-y-6 pb-6">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
                <input
                  checked={localOnlyMode}
                  className="mt-1"
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
                <span>
                  <span className="font-medium text-foreground">Local-only for this page (ZDR)</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    When enabled, this page stays on your device and is not written to Supabase.
                  </span>
                </span>
              </label>

              <SectionCard
                subtitle={labels.design_instructions.subtitle}
                title={labels.design_instructions.title}
                variant="system"
              >
                <div className="flex flex-col gap-3">
                  <textarea
                    data-dim-background="full"
                    className={cn(
                      "min-h-[22dvh] w-full resize-y rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-6 text-muted-foreground",
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
                    Save design instructions
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                subtitle={labels.ai_instructions.subtitle}
                title={labels.ai_instructions.title}
                variant="system"
              >
                <div className="flex flex-col gap-3">
                  <textarea
                    data-dim-background="full"
                    className={cn(
                      "min-h-[22dvh] w-full resize-y rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-6 text-muted-foreground",
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
                    Save AI instructions
                  </button>
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>

        {showGenerationStrip ? (
          <div
            className={cn(
              glass({ opaque: true }),
              "mb-2 flex shrink-0 flex-wrap items-center justify-center gap-3 rounded-xl border px-3 py-2.5 sm:justify-end"
            )}
          >
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                checked={overwriteElaborated}
                type="checkbox"
                onChange={(e) => setOverwriteElaborated(e.target.checked)}
              />
              Overwrite elaborated when updating
            </label>
            <button
              data-dim-background
              className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={isGenerating}
              type="button"
              onClick={runGenerate}
            >
              {isGenerating
                ? "Working…"
                : mode === "create"
                  ? "Generate"
                  : "Regenerate"}
            </button>
          </div>
        ) : null}

        <div className="flex shrink-0 justify-center pb-2">
          <div
            className={cn(
              glass({ opaque: true }),
              "inline-flex gap-1 rounded-full border border-border/70 p-1 shadow-sm"
            )}
            role="tablist"
            aria-label="Strata main sections"
          >
            {tabDefs.map((t) => (
              <button
                key={t.id}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  activeTab === t.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                role="tab"
                type="button"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";

import { saveStrataGeneratedSectionsAction, saveStrataSectionAction } from "../../actions";

import {
  getSectionLabels,
  buildRefinedSectionTitle,
  STRATA_MAIN_TAB_DEFS,
  type ActionStatusState,
  type SourceDocLayout,
  type SourceSaveState,
  type StrataMainTab,
} from "./strata-shell-model";

import {
  StrataGenerateResponseSchema,
  isUntitledStrataTitle,
  type StrataGenerationContext,
  type StrataPageWithSections,
  type StrataSectionKey,
  type StrataSourceComposerSettings,
} from "@/lib/schemas/strata";
import {
  getLocalOnlyMode,
  getLocalStrataPage,
  saveLocalStrataPage,
  setLocalOnlyMode,
} from "@/lib/strata/local-store";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { buildElaboratedContentJsonAfterModel } from "@/lib/strata/elaborated-tts";
import {
  parseTextSourcesFromContentJson,
  setTextSourcesInContentJson,
} from "@/lib/strata/text-sources";

const RAW_LOCAL_DEBOUNCE_MS = 1000;
const RAW_REMOTE_DEBOUNCE_MS = 10_000;

type RawPersistLayer = "local" | "database";

export function useStrataShellController(
  initialData: StrataPageWithSections,
  dbAvailable: boolean
) {
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
  const rawLocalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawRemoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localOnlyModeRef = useRef(localOnlyMode);
  const dbAvailableRef = useRef(dbAvailable);

  const [rawPersistLayer, setRawPersistLayer] = useState<RawPersistLayer>(() =>
    dbAvailable ? "database" : "local"
  );
  const [activeTab, setActiveTab] = useState<StrataMainTab>(() =>
    initialData.sections.elaborated.content.trim().length > 0 ? "synthesis" : "source"
  );
  const [sourceDocLayout, setSourceDocLayout] = useState<SourceDocLayout>("raw");
  const reduceMotion = useReducedMotion();
  const [sourceSave, setSourceSave] = useState<{
    state: SourceSaveState;
    at?: number;
    message?: string;
  }>({ state: "idle" });
  const [rawGenerationBaseline, setRawGenerationBaseline] = useState(() =>
    sanitizeRawUserInput(initialData.sections.raw_text.content)
  );

  const sectionsRef = useRef(sections);
  const pageDataRef = useRef(pageData);

  sectionsRef.current = sections;
  pageDataRef.current = pageData;

  localOnlyModeRef.current = localOnlyMode;
  dbAvailableRef.current = dbAvailable;

  const clearDebouncedRawPersistTimers = useCallback(() => {
    if (rawLocalTimerRef.current) {
      clearTimeout(rawLocalTimerRef.current);
      rawLocalTimerRef.current = null;
    }

    if (rawRemoteTimerRef.current) {
      clearTimeout(rawRemoteTimerRef.current);
      rawRemoteTimerRef.current = null;
    }
  }, []);

  const labels = useMemo(() => getSectionLabels(), []);
  const refinedSectionTitle = useMemo(
    () =>
      buildRefinedSectionTitle(
        (sections.refined_text.contentJson as { generatedTitle?: string } | null)?.generatedTitle ??
          ""
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
        setRawGenerationBaseline(sanitizeRawUserInput(localSnapshot.sections.raw_text.content));
        if (
          localSnapshot.sections.elaborated.content.trim().length > 0 &&
          initialData.sections.elaborated.content.trim().length === 0
        ) {
          setActiveTab("synthesis");
        }
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
      clearDebouncedRawPersistTimers();
    };
  }, [clearDebouncedRawPersistTimers]);

  const buildSanitizedRawNextSections = useCallback(() => {
    const prevSections = sectionsRef.current;
    const safeContent = sanitizeRawUserInput(prevSections.raw_text.content);
    const nextSections = {
      ...prevSections,
      raw_text: {
        ...prevSections.raw_text,
        content: safeContent,
      },
    };

    return { nextSections, safeContent };
  }, []);

  const persistRawLocalOnly = useCallback(async () => {
    const { nextSections } = buildSanitizedRawNextSections();

    sectionsRef.current = nextSections;
    setSections(nextSections);

    await saveLocalStrataPage({
      page: pageDataRef.current,
      sections: nextSections,
    });

    setRawPersistLayer("local");
  }, [buildSanitizedRawNextSections]);

  const persistRawRemoteOnly = useCallback(async () => {
    if (localOnlyModeRef.current || !dbAvailableRef.current) {
      return;
    }

    const { nextSections } = buildSanitizedRawNextSections();

    sectionsRef.current = nextSections;
    setSections(nextSections);

    await saveStrataSectionAction({
      pageId: initialData.page.id,
      ownerId: initialData.page.owner_id,
      sectionKey: "raw_text",
      content: nextSections.raw_text.content,
      contentJson: nextSections.raw_text.contentJson ?? null,
    });

    await saveLocalStrataPage({
      page: pageDataRef.current,
      sections: nextSections,
    });

    setRawPersistLayer("database");
  }, [buildSanitizedRawNextSections, initialData.page.id, initialData.page.owner_id]);

  const persistRawImmediatelyFull = useCallback(async () => {
    if (localOnlyModeRef.current || !dbAvailableRef.current) {
      await persistRawLocalOnly();
    } else {
      await persistRawRemoteOnly();
    }
  }, [persistRawLocalOnly, persistRawRemoteOnly]);

  const runRawPersistWithActionBanner = useCallback(async () => {
    setActionStatus({
      state: "loading",
      text: localOnlyMode || !dbAvailable ? "Saving locally" : "Saving section",
    });

    try {
      const typedSnapshot = sectionsRef.current.raw_text.content;

      await persistRawImmediatelyFull();

      const sanitized = sanitizeRawUserInput(typedSnapshot);

      let completedText =
        !localOnlyMode && dbAvailable
          ? "Saved to Supabase + encrypted local device storage."
          : "Saved to encrypted local device storage (ZDR).";

      if (sanitized !== typedSnapshot) {
        completedText =
          "Raw text saved with safety sanitization to protect against XSS and prompt injection.";
      }

      setActionStatus({ state: "completed", text: completedText });
    } catch (err) {
      setActionStatus({
        state: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
      throw err;
    }
  }, [dbAvailable, localOnlyMode, persistRawImmediatelyFull]);

  const mode = useMemo<"create" | "update">(() => {
    const hasRefined = sections.refined_text.content.trim().length > 0;
    const hasElaborated = sections.elaborated.content.trim().length > 0;

    return hasRefined && hasElaborated ? "update" : "create";
  }, [sections.elaborated.content, sections.refined_text.content]);

  const saveSection = (sectionKey: StrataSectionKey, content: string) => {
    if (sectionKey === "raw_text") {
      void content;
      clearDebouncedRawPersistTimers();
      startTransition(() => {
        void runRawPersistWithActionBanner();
      });

      return;
    }

    setActionStatus({
      state: "loading",
      text: localOnlyMode || !dbAvailable ? "Saving locally" : "Saving section",
    });

    startTransition(async () => {
      try {
        const safeContent = content;
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

        setSections(nextSections);
        sectionsRef.current = nextSections;

        const completedText =
          !localOnlyMode && dbAvailable
            ? "Saved to Supabase + encrypted local device storage."
            : "Saved to encrypted local device storage (ZDR).";

        setActionStatus({ state: "completed", text: completedText });
      } catch (err) {
        setActionStatus({
          state: "error",
          text: err instanceof Error ? err.message : "Failed to save",
        });
      }
    });
  };

  const queueRawAutosave = useCallback(() => {
    clearDebouncedRawPersistTimers();
    setSourceSave((prev) => (prev.state === "error" ? prev : { state: "saving", at: Date.now() }));

    rawLocalTimerRef.current = setTimeout(() => {
      rawLocalTimerRef.current = null;
      void (async () => {
        try {
          await persistRawLocalOnly();

          const onlyLocal = localOnlyModeRef.current || !dbAvailableRef.current;

          if (onlyLocal) {
            setSourceSave({
              state: "saved",
              at: Date.now(),
              message: "Saved locally",
            });
          }
        } catch (err) {
          setSourceSave({
            state: "error",
            at: Date.now(),
            message: err instanceof Error ? err.message : "Failed to save locally",
          });
        }
      })();
    }, RAW_LOCAL_DEBOUNCE_MS);

    if (dbAvailableRef.current && !localOnlyModeRef.current) {
      rawRemoteTimerRef.current = setTimeout(() => {
        rawRemoteTimerRef.current = null;
        void (async () => {
          try {
            await persistRawRemoteOnly();
            const net = dbAvailableRef.current && !localOnlyModeRef.current;

            if (net) {
              setSourceSave({
                state: "saved",
                at: Date.now(),
                message: "Saved",
              });
            }
          } catch (err) {
            setSourceSave({
              state: "error",
              at: Date.now(),
              message: err instanceof Error ? err.message : "Failed to sync to Supabase",
            });
          }
        })();
      }, RAW_REMOTE_DEBOUNCE_MS);
    }
  }, [
    clearDebouncedRawPersistTimers,
    persistRawLocalOnly,
    persistRawRemoteOnly,
  ]);

  const applySourceComposerSettingsPatch = useCallback(
    (patch: Partial<StrataSourceComposerSettings>) => {
      setSections((prev) => {
        const sources = parseTextSourcesFromContentJson(
          prev.raw_text.contentJson as Record<string, unknown> | null
        );
        const contentJson = setTextSourcesInContentJson(
          prev.raw_text.contentJson as Record<string, unknown> | null,
          sources,
          patch
        );

        return {
          ...prev,
          raw_text: {
            ...prev.raw_text,
            contentJson,
          },
        };
      });
      queueRawAutosave();
    },
    [queueRawAutosave]
  );

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
              (
                sections.raw_text.contentJson as {
                  generationContext?: StrataGenerationContext;
                } | null
              )?.generationContext ?? undefined,
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
      setRawGenerationBaseline(sanitizeRawUserInput(nextSections.raw_text.content));
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
      const t = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(
        new Date(sourceSave.at)
      );

      return `${sourceSave.message ?? "Saved"} · ${t}`;
    }

    return sourceSave.message ?? "Saved";
  }, [sourceSave]);

  const flushSaveRaw = useCallback(async (): Promise<void> => {
    clearDebouncedRawPersistTimers();
    await runRawPersistWithActionBanner();
  }, [clearDebouncedRawPersistTimers, runRawPersistWithActionBanner]);

  const rawSyncFooter = useMemo(
    () =>
      ({
        busy:
          sourceSave.state === "saving" ||
          (actionStatus.state === "loading" &&
            (actionStatus.text === "Saving section" ||
              actionStatus.text === "Saving locally")),
        label:
          sourceSave.state === "saving" ||
          (actionStatus.state === "loading" &&
            (actionStatus.text === "Saving section" ||
              actionStatus.text === "Saving locally"))
            ? "Saving…"
            : localOnlyMode || !dbAvailable
              ? "Synced via local cache"
              : rawPersistLayer === "database"
                ? "Synced via database"
                : "Synced via local cache",
      }) as const,
    [
      actionStatus.state,
      actionStatus.text,
      dbAvailable,
      localOnlyMode,
      rawPersistLayer,
      sourceSave.state,
    ]
  );

  const rawDriftedFromGeneration = useMemo(
    () => sanitizeRawUserInput(sections.raw_text.content) !== rawGenerationBaseline,
    [sections.raw_text.content, rawGenerationBaseline]
  );

  const showGenerationStrip = useMemo(() => {
    if (rawDriftedFromGeneration) {
      return activeTab === "source" || activeTab === "synthesis";
    }

    return false;
  }, [rawDriftedFromGeneration, activeTab]);

  const applyLocalOnlyMode = useCallback(
    (enabled: boolean) => {
      setLocalOnlyMode(initialData.page.id, enabled);
      setLocalOnlyModeState(enabled);
      setActionStatus({
        state: "completed",
        text: enabled
          ? "Local-only mode enabled for this page (ZDR)."
          : "Local-only mode disabled for this page.",
      });
    },
    [initialData.page.id]
  );

  return {
    pageData,
    sections,
    setSections,
    labels,
    refinedSectionTitle,
    activeTab,
    setActiveTab,
    tabDefs: STRATA_MAIN_TAB_DEFS,
    sourceDocLayout,
    setSourceDocLayout,
    sourceSave,
    sourceSaveLabel,
    queueRawAutosave,
    flushSaveRaw,
    rawSyncFooter,
    reduceMotion,
    isGenerating,
    persistElaboratedContentJson,
    localOnlyMode,
    dbAvailable,
    applyLocalOnlyMode,
    saveSection,
    actionStatus,
    setActionStatus,
    isPending,
    showGenerationStrip,
    overwriteElaborated,
    setOverwriteElaborated,
    runGenerate,
    mode,
    refs: {
      scrollContainerRef,
      elaboratedRef,
    },
    applySourceComposerSettingsPatch,
  };
}

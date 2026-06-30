"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { CoalescenceGate } from "./CoalescenceGate";
import { ArtifactSpatialStage } from "./spatial/ArtifactSpatialStage";
import { AudioRackZone } from "./zones/AudioRackZone";
import { BookshelfZone } from "./zones/BookshelfZone";
import { PlansZone } from "./zones/PlansZone";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import {
  actionBulkSyncSpatialArtifacts,
  actionListSpatialArtifacts,
} from "@/app/actions/spatial-artifacts";
import { ArtifactSpatialProvider } from "@/lib/context/artifact-spatial-context";
import { useCoalescenceMode } from "@/hooks/use-coalescence-mode";
import type { SpatialArtifact, SpatialArtifactFilter } from "@/lib/schemas/spatial-artifact";
import type { GenUIBlockType } from "@/lib/schemas/gen-ui";
import {
  artifactMatchesFilter,
  primaryZoneForBlockType,
  visibleZonesForFilter,
} from "@/lib/spatial-artifacts/zone-routing";
import { cn } from "@/lib/utils";

const FILTERS: { id: SpatialArtifactFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned" },
  { id: "plans", label: "Plans" },
  { id: "audio", label: "Audio" },
  { id: "guides", label: "Guides" },
];

type SpatialArchetypesBrowserProps = {
  initialArtifacts: SpatialArtifact[];
  initialDisabled?: boolean;
};

export function SpatialArchetypesBrowser({
  initialArtifacts,
  initialDisabled,
}: SpatialArchetypesBrowserProps) {
  const coalescenceMode = useCoalescenceMode();
  const searchParams = useSearchParams();
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [filter, setFilter] = useState<SpatialArtifactFilter>("all");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const disabled = initialDisabled || !coalescenceMode;

  const refresh = useCallback(async () => {
    if (!coalescenceMode) return;

    const result = await actionListSpatialArtifacts({ coalescenceMode: true });

    if (!result.disabled) setArtifacts(result.artifacts);
  }, [coalescenceMode]);

  useEffect(() => {
    if (disabled) return;

    void actionBulkSyncSpatialArtifacts({ coalescenceMode: true, maxThreads: 30 });
    const t = window.setTimeout(() => void refresh(), 2500);

    return () => window.clearTimeout(t);
  }, [disabled, refresh]);

  useEffect(() => {
    const artifactParam = searchParams.get("artifact");
    const expand = searchParams.get("expand") === "1";

    if (!artifactParam || disabled) return;

    if (expand) setExpandedPlanId(artifactParam);

    const el = document.querySelector(`[data-artifact-slot*="${artifactParam}"]`);

    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchParams, disabled]);

  const filtered = useMemo(
    () =>
      artifacts.filter((a) =>
        artifactMatchesFilter(a.block.type as GenUIBlockType, a.pinned, filter)
      ),
    [artifacts, filter]
  );

  const byZone = useMemo(() => {
    const plans = filtered.filter((a) => primaryZoneForBlockType(a.block.type) === "plans");
    const audio = filtered.filter((a) => primaryZoneForBlockType(a.block.type) === "audio");
    const bookshelf = filtered.filter(
      (a) => primaryZoneForBlockType(a.block.type) === "bookshelf"
    );

    return { plans, audio, bookshelf };
  }, [filtered]);

  const zones = visibleZonesForFilter(filter);

  if (disabled) {
    return (
      <Page className="items-stretch justify-start overflow-hidden" liquidChromeBackground>
        <AdaptiveLiquidChrome cover="parent" />
        <div className="relative z-[1] h-full min-h-0 w-full overflow-y-auto pb-16">
          <PageContentFrame maxWidth="6xl">
            <PageNavBack className="mb-8" href="/sandbox/prototypes">
              ← Prototypes
            </PageNavBack>
            <CoalescenceGate />
          </PageContentFrame>
        </div>
      </Page>
    );
  }

  return (
    <Page className="items-stretch justify-start overflow-hidden" liquidChromeBackground>
      <AdaptiveLiquidChrome cover="parent" />
      <div className="relative z-[1] h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="6xl">
          <PageNavBack className="mb-8" href="/sandbox/prototypes">
            ← Prototypes
          </PageNavBack>

          <header className="mb-6 space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Spatial Archetypes</h1>
            <p className="text-sm text-muted-foreground">
              Revisit gen-ui blocks from your threads — plans, guides, and audio — in a spatial
              library.
            </p>
          </header>

          <nav className="mb-8 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  filter === f.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </nav>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No artifacts yet. Run an Arcadia chat with gen-ui blocks, or pin one from chat.
            </p>
          ) : (
            <ArtifactSpatialProvider>
              <div className="relative min-h-[40rem] space-y-12">
                {(zones === "all" || zones.includes("plans")) && byZone.plans.length > 0 ? (
                  <PlansZone
                    artifacts={byZone.plans}
                    expandedId={expandedPlanId}
                    onExpand={setExpandedPlanId}
                  />
                ) : null}
                {(zones === "all" || zones.includes("audio")) && byZone.audio.length > 0 ? (
                  <AudioRackZone artifacts={byZone.audio} />
                ) : null}
                {(zones === "all" || zones.includes("bookshelf")) &&
                byZone.bookshelf.length > 0 ? (
                  <BookshelfZone artifacts={byZone.bookshelf} />
                ) : null}
                <ArtifactSpatialStage artifacts={filtered} />
              </div>
            </ArtifactSpatialProvider>
          )}
        </PageContentFrame>
      </div>
    </Page>
  );
}

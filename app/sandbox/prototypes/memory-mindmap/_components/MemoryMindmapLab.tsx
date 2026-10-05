"use client";

import type { MemorySector, MemoryTouchKind, MemoryTrace } from "@/lib/memory/mindmap";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  MemoryMindmapPopup,
  MemoryMindmapTrigger,
} from "@/components/memory/mindmap/MemoryMindmapPopup";
import {
  MEMORY_TOUCH_GLOW,
  MEMORY_TOUCH_LINGER_MS,
} from "@/components/memory/mindmap/memory-mindmap-glow";
import { glass } from "@/components/design-system/primitives";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import {
  FIXTURE_MEMORY_TRACES,
  MEMORY_MINDMAP_ROOT_FOCUS,
  canDrillIntoSector,
  childSectorsForFocus,
  focusFromSector,
  memoryItemToTrace,
  type MindmapFocus,
} from "@/lib/memory/mindmap";
import { getCurrentUserMemories } from "@/lib/memory/operations";
import { cn } from "@/lib/utils";

function initialCounts(sectors: MemorySector[]): Record<string, number> {
  return Object.fromEntries(sectors.map((s) => [s.id, s.memoryIds.length]));
}

export function MemoryMindmapLab() {
  const [open, setOpen] = useState(true);
  const [source, setSource] = useState<"fixture" | "live">("fixture");
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [traces, setTraces] = useState<MemoryTrace[]>(FIXTURE_MEMORY_TRACES);
  const [stack, setStack] = useState<MindmapFocus[]>([MEMORY_MINDMAP_ROOT_FOCUS]);
  const focus = stack[stack.length - 1] ?? MEMORY_MINDMAP_ROOT_FOCUS;
  const sectors = useMemo(() => childSectorsForFocus(traces, focus), [traces, focus]);
  const [counts, setCounts] = useState<Record<string, number>>(() => initialCounts(sectors));
  const [selectedId, setSelectedId] = useState<string | null>(sectors[0]?.id ?? null);
  const [inContextMemoryIds, setInContextMemoryIds] = useState<Set<string>>(() => new Set());
  const [touches, setTouches] = useState<Partial<Record<string, MemoryTouchKind>>>({});
  const [liveMessage, setLiveMessage] = useState("Click a sector to go deeper. Center rises.");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setStack([MEMORY_MINDMAP_ROOT_FOCUS]);
    setInContextMemoryIds(new Set());
    setTouches({});
  }, [traces]);

  useEffect(() => {
    setCounts(initialCounts(sectors));
    setSelectedId(sectors[0]?.id ?? null);
  }, [sectors]);

  const inContextIds = useMemo(() => {
    const ids = new Set<string>();

    for (const sector of sectors) {
      if (sector.memoryIds.some((id) => inContextMemoryIds.has(id))) ids.add(sector.id);
    }

    return ids;
  }, [sectors, inContextMemoryIds]);

  useEffect(() => {
    const current = timers.current;

    return () => {
      for (const id of current) window.clearTimeout(id);
    };
  }, []);

  const selected = sectors.find((s) => s.id === selectedId) ?? sectors[0];

  const pulse = useCallback(
    (sectorId: string, kind: MemoryTouchKind, extra?: string) => {
      const label = sectors.find((s) => s.id === sectorId)?.label ?? "Sector";

      setTouches((prev) => ({ ...prev, [sectorId]: kind }));
      setLiveMessage(`${MEMORY_TOUCH_GLOW[kind].label} · ${label}${extra ? ` ${extra}` : ""}`);
      const timeout = window.setTimeout(() => {
        setTouches((prev) => {
          const next = { ...prev };

          delete next[sectorId];

          return next;
        });
      }, MEMORY_TOUCH_LINGER_MS);

      timers.current.push(timeout);
    },
    [sectors]
  );

  const simulateTurn = useCallback(() => {
    const picks = sectors.slice(0, Math.min(3, sectors.length));
    const next = new Set(picks.flatMap((s) => s.memoryIds));

    setInContextMemoryIds(next);
    setOpen(true);
    picks.forEach((sector, i) => {
      const timeout = window.setTimeout(
        () => pulse(sector.id, "accessed", "— auto-grabbed"),
        i * 280
      );

      timers.current.push(timeout);
    });
  }, [pulse, sectors]);

  const applyTouch = useCallback(
    (kind: MemoryTouchKind) => {
      if (!selected) return;
      setOpen(true);

      if (kind === "accessed") {
        setInContextMemoryIds((prev) => {
          const next = new Set(prev);

          for (const id of selected.memoryIds) next.add(id);

          return next;
        });
      }
      if (kind === "created") {
        setCounts((prev) => ({ ...prev, [selected.id]: (prev[selected.id] ?? 0) + 1 }));
      }
      if (kind === "deleted") {
        setCounts((prev) => ({
          ...prev,
          [selected.id]: Math.max(0, (prev[selected.id] ?? 0) - 1),
        }));
      }

      pulse(selected.id, kind);
    },
    [pulse, selected]
  );

  const onSectorClick = useCallback(
    (sectorId: string) => {
      const sector = sectors.find((s) => s.id === sectorId);

      if (!sector) return;
      setSelectedId(sectorId);

      if (canDrillIntoSector(traces, focus, sector)) {
        setStack((prev) => [...prev, focusFromSector(focus, sector)]);
        setLiveMessage(sector.label);
      }
    },
    [focus, sectors, traces]
  );

  const goUp = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const loadLive = useCallback(async () => {
    setLiveStatus("Loading corpus…");
    const result = await getCurrentUserMemories();

    if (result.error || !result.data?.results?.length) {
      setLiveStatus(result.error ?? "No live memories — staying on fixtures.");
      setSource("fixture");
      setTraces(FIXTURE_MEMORY_TRACES);

      return;
    }

    setSource("live");
    setTraces(result.data.results.map(memoryItemToTrace));
    setLiveStatus(`Mapped ${result.data.results.length} memories from your corpus.`);
  }, []);

  const useFixtures = useCallback(() => {
    setSource("fixture");
    setTraces(FIXTURE_MEMORY_TRACES);
    setLiveStatus(null);
  }, []);

  return (
    <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-y-auto pb-16">
      <PageContentFrame maxWidth="3xl">
        <PageNavBack className="mb-8" href="/sandbox/prototypes">
          ← Prototypes
        </PageNavBack>

        <header className="mb-8 space-y-2">
          <p className="text-2xs uppercase tracking-[0.28em] text-muted-foreground/80">Sandbox</p>
          <h1 className="font-commissioner text-3xl font-extralight tracking-tight text-foreground sm:text-4xl">
            Memory mind map
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Click a sector to go one layer deeper. Click the center node to rise. Memory is the root
            — you cannot go above it.
          </p>
        </header>

        <div
          className={cn(glass({ opaque: true }), "relative overflow-hidden rounded-3xl p-5 sm:p-6")}
        >
          <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Chat surface
          </p>
          <div className="mb-8 space-y-3 text-sm text-foreground/85">
            <p className="text-muted-foreground">You</p>
            <p>What do you already know about how I like to work?</p>
            <p className="pt-2 text-muted-foreground">Arcadia</p>
            <p>
              Quiet rooms, dark mode, bun instead of npm — and the work lives on Aetherion. The map
              is showing which parts of memory that answer just touched.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <MemoryMindmapTrigger pressed={open} onClick={() => setOpen((v) => !v)} />
            <span className="text-[11px] text-muted-foreground">
              {source === "live" ? "Live corpus" : "Fixture corpus"}
            </span>
          </div>
        </div>

        <section className="mt-8 space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Lab
          </h2>
          <div className="flex flex-wrap gap-2">
            <LabButton onClick={simulateTurn}>Simulate auto-grab</LabButton>
            <LabButton onClick={() => applyTouch("accessed")}>Access</LabButton>
            <LabButton onClick={() => applyTouch("created")}>Create</LabButton>
            <LabButton onClick={() => applyTouch("updated")}>Update</LabButton>
            <LabButton onClick={() => applyTouch("deleted")}>Delete</LabButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <LabButton onClick={useFixtures}>Fixtures</LabButton>
            <LabButton onClick={() => void loadLive()}>Load live memories</LabButton>
          </div>
          {selected ? (
            <p className="text-xs text-muted-foreground">
              Selected sector: <span className="text-foreground">{selected.label}</span>
            </p>
          ) : null}
          {liveStatus ? <p className="text-xs text-muted-foreground">{liveStatus}</p> : null}
        </section>
      </PageContentFrame>

      <MemoryMindmapPopup
        canGoUp={stack.length > 1}
        centerLabel={focus.label}
        counts={counts}
        inContextIds={inContextIds}
        liveMessage={liveMessage}
        open={open}
        sectors={sectors}
        selectedId={selected?.id ?? null}
        touches={touches}
        onCenterClick={goUp}
        onOpenChange={setOpen}
        onSelectSector={onSectorClick}
      />
    </div>
  );
}

function LabButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="rounded-full border border-white/15 bg-background/40 px-3 py-1.5 text-xs text-foreground/85 transition hover:border-cyan-400/30 hover:text-foreground"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

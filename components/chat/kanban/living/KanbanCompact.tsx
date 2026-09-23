"use client";

import type { KanbanActivity, LightBehavior, LivingLight } from "./living-light";
import type { KanbanBoardState, StoredKanbanItem } from "@/lib/kanban/store";
import type { KanbanStatus, KanbanView } from "@/lib/schemas/kanban";
import type { Ref } from "react";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Maximize2 } from "lucide-react";
import { memo, useId, useMemo, useRef, useState } from "react";

import { CountTick } from "./CountTick";
import { PriorityGlyph, STATUS_DOT, StatusGlyph } from "./KanbanGlyphs";
import { LivingBoard } from "./LivingBoard";
import {
  LIVING_CARD_SPRING,
  LIVING_LANE_FLASH_S,
  LIVING_LANE_SPRING,
  LIVING_WASH_S,
} from "./living-board-timing";
import { IDLE_ACTIVITY, LIGHT_BEHAVIOR } from "./living-light";
import { freshStamp, useBoardChanges } from "./use-board-changes";
import { useOneShot } from "./use-one-shot";

import { glass } from "@/components/design-system/primitives";
import { Dialog, DialogContent, DialogTitle } from "@/components/third-party/ui/dialog";
import {
  countStatuses,
  KANBAN_STATUS_SHORT_LABELS,
  selectSpotlightItems,
} from "@/lib/kanban/board-lanes";
import { selectViewItems } from "@/lib/kanban/select-view";
import { KANBAN_STATUSES } from "@/lib/schemas/kanban";
import { cn } from "@/lib/utils";

/** Flat fills for the distribution bar; same meaning map as the glyphs. */
const STATUS_BAR: Record<KanbanStatus, string> = {
  backlog: "bg-foreground/15",
  todo: "bg-foreground/25",
  active: "bg-lumen",
  in_review: "bg-foreground/40",
  blocked: "bg-rose-500/80",
  done: "bg-accent/80",
};

const PING_KEYFRAMES: Keyframe[] = [
  { opacity: 1, transform: "scale(1)" },
  { opacity: 0, transform: "scale(2.4)" },
];

const WASH_KEYFRAMES: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

type KanbanCompactProps = {
  board: KanbanBoardState | undefined;
  view: KanbanView;
  /** What "Open board" expands to. */
  boardView: KanbanView;
  light: LivingLight;
  activity?: KanbanActivity;
  spotlightLimit?: number;
};

/**
 * A view summarized inside a message: where the whole board stands, the few cards the answer
 * is about, and a way out to the full board.
 */
export const KanbanCompact = memo(function KanbanCompact({
  board,
  view,
  boardView,
  light,
  activity = IDLE_ACTIVITY,
  spotlightLimit = 3,
}: KanbanCompactProps) {
  const behavior = LIGHT_BEHAVIOR[light];
  const layoutGroupId = useId();
  const changes = useBoardChanges(board);
  const [open, setOpen] = useState(false);

  const viewItems = useMemo(() => (board ? selectViewItems(board, view) : []), [board, view]);
  const spotlight = useMemo(
    () => selectSpotlightItems(viewItems, view, spotlightLimit),
    [spotlightLimit, view, viewItems]
  );
  const counts = useMemo(() => countStatuses(Object.values(board?.items ?? {})), [board]);
  const scope = view.filter?.statuses;
  const inScope = (status: KanbanStatus) => !scope || scope.length === 0 || scope.includes(status);
  const hiddenCount = viewItems.length - spotlight.length;

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "not-prose rounded-2xl border border-border/50 px-3.5 pb-2.5 pt-3"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {board?.meta.title ?? "Ergon board"}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-medium text-foreground">{view.title}</h3>
          {view.summary ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{view.summary}</p>
          ) : null}
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.04] hover:text-foreground disabled:opacity-50"
          disabled={!board}
          type="button"
          onClick={() => setOpen(true)}
        >
          <Maximize2 aria-hidden className="size-3" />
          Open board
        </button>
      </div>

      <div aria-hidden className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <AnimatePresence initial={false}>
          {KANBAN_STATUSES.filter((status) => counts[status] > 0).map((status) => (
            <motion.span
              key={status}
              layout
              animate={{ opacity: inScope(status) ? 1 : 0.35 }}
              className={cn("h-full", STATUS_BAR[status])}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ flexGrow: counts[status], borderRadius: 999 }}
              transition={LIVING_LANE_SPRING}
            />
          ))}
        </AnimatePresence>
      </div>
      <ul
        aria-label="Cards by status"
        className="mt-2 flex gap-3 overflow-x-auto whitespace-nowrap text-[11px] text-muted-foreground [scrollbar-width:none]"
      >
        {KANBAN_STATUSES.map((status) => (
          <li
            key={status}
            className={cn(
              "inline-flex items-center gap-1.5 transition-opacity",
              (counts[status] === 0 || !inScope(status)) && "opacity-50"
            )}
          >
            <DotLight
              stamp={changes.gainedLanes.has(status) ? changes.stamp : undefined}
              status={status}
            />
            {KANBAN_STATUS_SHORT_LABELS[status]}
            <CountTick className="text-foreground/80" value={counts[status]} />
          </li>
        ))}
      </ul>

      <LayoutGroup id={layoutGroupId}>
        <ul className="mt-2.5 flex flex-col">
          <AnimatePresence initial={false} mode="popLayout">
            {spotlight.map((item) => (
              <SpotlightRow
                key={item.id}
                behavior={behavior}
                freshStamp={freshStamp(changes, item.id)}
                item={item}
              />
            ))}
          </AnimatePresence>
          {board && spotlight.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              Nothing matches this view yet.
            </li>
          ) : null}
        </ul>
      </LayoutGroup>
      {hiddenCount > 0 ? (
        <button
          className="mt-0.5 px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          type="button"
          onClick={() => setOpen(true)}
        >
          +{hiddenCount} more on the board
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[min(94vw,72rem)] max-w-none gap-0 border-none bg-transparent p-0 shadow-none sm:rounded-2xl [&>button:last-child]:-top-9 [&>button:last-child]:right-1 [&>button:last-child]:text-white"
          overlayClassName="bg-black/45 backdrop-blur-[2px]"
        >
          <DialogTitle className="sr-only">{board?.meta.title ?? "Ergon board"}</DialogTitle>
          <LivingBoard activity={activity} board={board} light={light} view={boardView} />
        </DialogContent>
      </Dialog>
    </div>
  );
});

/** Status dot that pings when its lane gains a card. */
function DotLight({ status, stamp }: { status: KanbanStatus; stamp?: number }) {
  const pingRef = useRef<HTMLSpanElement>(null);

  useOneShot(pingRef, stamp, PING_KEYFRAMES, {
    duration: LIVING_LANE_FLASH_S * 1000,
    easing: "ease-out",
  });

  return (
    <span className="relative inline-flex size-1.5 shrink-0">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      <span
        ref={pingRef}
        aria-hidden
        className="absolute inset-0 rounded-full bg-[rgb(var(--lumen)/0.7)] opacity-0"
      />
    </span>
  );
}

function SpotlightRow({
  item,
  behavior,
  freshStamp: stamp,
  ref,
}: {
  item: StoredKanbanItem;
  behavior: LightBehavior;
  freshStamp?: number;
  /** `AnimatePresence mode="popLayout"` measures exiting rows through this. */
  ref?: Ref<HTMLLIElement>;
}) {
  const washRef = useRef<HTMLSpanElement>(null);
  const inProgress = item.progress > 0 && item.progress < 100;
  const [tag] = item.tags ?? [];

  useOneShot(washRef, stamp, WASH_KEYFRAMES, {
    duration: LIVING_WASH_S * 1000,
    easing: "ease-out",
  });

  return (
    <motion.li
      ref={ref}
      layout
      animate={{ opacity: 1 }}
      className="relative isolate flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5"
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      initial={{ opacity: 0 }}
      layoutId={`spotlight-${item.id}`}
      transition={LIVING_CARD_SPRING}
    >
      <span
        ref={washRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0",
          behavior.wash === "strong" ? "bg-[rgb(var(--lumen)/0.24)]" : "bg-[rgb(var(--lumen)/0.14)]"
        )}
      />
      <StatusGlyph status={item.status} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] text-foreground",
          item.status === "done" && "text-muted-foreground"
        )}
      >
        {item.title}
      </span>
      {inProgress ? (
        <span
          aria-label={`${item.progress}% done`}
          className="h-[2px] w-10 shrink-0 overflow-hidden rounded-full bg-foreground/[0.08]"
          role="img"
        >
          <motion.span
            animate={{ width: `${item.progress}%` }}
            className={cn(
              "block h-full rounded-full",
              item.status === "active" ? "bg-lumen" : "bg-foreground/35"
            )}
            initial={false}
          />
        </span>
      ) : null}
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <PriorityGlyph priority={item.priority} />
        {item.priority === "urgent" ? (
          <span className="text-rose-500 dark:text-rose-400">Urgent</span>
        ) : tag ? (
          <span className="hidden sm:inline">{tag}</span>
        ) : null}
      </span>
    </motion.li>
  );
}

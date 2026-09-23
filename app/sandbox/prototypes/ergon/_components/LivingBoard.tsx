"use client";

import type { KanbanActivity, LivingLight } from "./living-light";
import type { KanbanBoardState } from "@/lib/kanban/store";
import type { KanbanView } from "@/lib/schemas/kanban";
import type { CSSProperties } from "react";

import { LayoutGroup, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { memo, useEffect, useId, useMemo, useRef } from "react";

import { centerWithin, findCard, offsetWithin } from "./board-dom";
import { LivingLane } from "./LivingLane";
import { describeKanbanCommand, IDLE_ACTIVITY, LIGHT_BEHAVIOR } from "./living-light";
import { launchSparks, PresenceOrb } from "./Presence";
import { useBoardChanges } from "./use-board-changes";

import { glass } from "@/components/design-system/primitives";
import { buildBoardLanes } from "@/lib/kanban/board-lanes";
import { selectViewItems } from "@/lib/kanban/select-view";
import { cn } from "@/lib/utils";

/** Breathing room kept around a card that a squeezed board scrolls into view. */
const FOLLOW_MARGIN_PX = 16;

/**
 * Lane widths, resolved against the scroller as a size container. A full lane keeps one width
 * however many neighbours fold — four full lanes and two rails fill the board (gaps are the
 * row's `gap-2`, and 1.5rem its `px-3`) — so a fold slides lanes aside without re-wrapping a
 * single card. A narrower board scrolls sideways instead.
 */
const LANE_SIZES = {
  "--lane-rail": "2.25rem",
  "--lane-full":
    "clamp(9.5rem, calc((100cqw - 1.5rem - 2 * var(--lane-rail) - 5 * 0.5rem) / 4), 16rem)",
  "--lane-hold": "max(4.5rem, calc((100cqw - 1.5rem - 5 * 0.5rem) / 6))",
} as CSSProperties;

type LivingBoardProps = {
  board: KanbanBoardState | undefined;
  view: KanbanView;
  light: LivingLight;
  activity?: KanbanActivity;
  /** Scroll a squeezed board so the card the model just changed stays in view. */
  followChanges?: boolean;
  className?: string;
};

export const LivingBoard = memo(function LivingBoard({
  board,
  view,
  light,
  activity = IDLE_ACTIVITY,
  followChanges = false,
  className,
}: LivingBoardProps) {
  const behavior = LIGHT_BEHAVIOR[light];
  const reduceMotion = useReducedMotion() ?? false;
  const layoutGroupId = useId();
  const changes = useBoardChanges(board);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLSpanElement>(null);
  const sparkLayerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => (board ? selectViewItems(board, view) : []), [board, view]);
  const lanes = useMemo(() => buildBoardLanes(items, view), [items, view]);
  const isList = (view.groupBy ?? "status") === "none";
  const settingUp = !board || board.status === "initializing";
  const laneMode = isList ? "list" : settingUp ? "hold" : "fold";

  const working = activity.phase === "working";
  const attendedId = activity.phase === "working" ? activity.targetId : undefined;
  const caption =
    activity.phase === "working" ? describeKanbanCommand(activity.command, board) : undefined;

  // A change just landed: keep its card in view and send the presence spark to it. Glides are
  // transforms, so layout is already final and offsets are where the cards come to rest.
  useEffect(() => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;

    if (changes.stamp === 0 || !root || !scroller) return;
    if (!followChanges && !behavior.presence) return;

    const frame = requestAnimationFrame(() => {
      const cards = [...changes.touched].flatMap((id) => findCard(root, id) ?? []);
      const [first] = cards;

      if (!first) return;

      let scrollLeft = scroller.scrollLeft;

      if (followChanges) {
        const { x } = offsetWithin(first, scroller);
        const right = x + first.offsetWidth;
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;

        if (x - FOLLOW_MARGIN_PX < scrollLeft) scrollLeft = x - FOLLOW_MARGIN_PX;
        else if (right + FOLLOW_MARGIN_PX > scrollLeft + scroller.clientWidth) {
          scrollLeft = right + FOLLOW_MARGIN_PX - scroller.clientWidth;
        }
        scrollLeft = Math.max(0, Math.min(scrollLeft, maxScroll));

        if (scrollLeft !== scroller.scrollLeft) {
          scroller.scrollTo({ left: scrollLeft, behavior: reduceMotion ? "auto" : "smooth" });
        }
      }

      const orb = orbRef.current;
      const layer = sparkLayerRef.current;

      if (!behavior.presence || reduceMotion || !orb || !layer) return;

      launchSparks(
        layer,
        centerWithin(orb, root),
        cards.map((card) => {
          const center = centerWithin(card, root);

          return { x: center.x - scrollLeft, y: center.y - scroller.scrollTop };
        })
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [changes.stamp]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className={cn(
          glass({ opaque: true }),
          "not-prose relative isolate overflow-hidden rounded-2xl border border-border/50",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 px-4 pt-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {board?.meta.title ?? "Ergon board"}
            </p>
            <h3 className="mt-0.5 truncate text-sm font-medium text-foreground">{view.title}</h3>
            {view.summary ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{view.summary}</p>
            ) : null}
          </div>
          {behavior.presence ? (
            <PresenceOrb ref={orbRef} caption={caption} working={working} />
          ) : null}
        </div>

        <LayoutGroup id={layoutGroupId}>
          <motion.div
            ref={scrollerRef}
            layoutScroll
            className="@container relative overflow-x-auto overscroll-x-contain pb-3 pt-3 [scrollbar-width:thin]"
          >
            {!settingUp && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nothing matches this view yet.
              </p>
            ) : (
              // Lanes never wrap into rows; a squeezed board scrolls sideways instead. The row
              // clips sideways so a lane sliding in at its new width never widens the scroll
              // area mid-glide (a scrollbar would flash and jolt the board).
              <div
                className={cn(
                  "flex gap-2 overflow-x-clip px-3",
                  isList ? "w-full" : "w-max min-w-full"
                )}
                style={LANE_SIZES}
              >
                {lanes.map((lane) => (
                  <LivingLane
                    key={lane.key}
                    attendedId={attendedId}
                    behavior={behavior}
                    changes={changes}
                    lane={lane}
                    mode={laneMode}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </LayoutGroup>

        {behavior.presence ? (
          <div
            ref={sparkLayerRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          />
        ) : null}
      </div>
    </MotionConfig>
  );
});

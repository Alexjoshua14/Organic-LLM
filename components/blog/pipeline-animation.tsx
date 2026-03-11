"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FIGURE_HEIGHT = 180;

const BOUNDARY_STYLE =
  "rounded-lg border-2 border-border/60 bg-muted/30 px-4 py-3 min-h-[96px] flex flex-col justify-start shrink-0";
const TUNNEL_STYLE =
  "rounded-md border-2 border-dashed border-border/50 flex flex-col items-center justify-start pt-3 min-h-[96px] relative overflow-visible shrink-0 bg-primary/[0.15] backdrop-blur-[2px] z-30";

const GAP = 8;
const COL_USER = 152;
const COL_TUNNEL = 70;
const COL_NEXTJS = 192;
const COL_DATABASE = 120;
const GRID_COLS = `${COL_USER}px ${COL_TUNNEL}px ${COL_NEXTJS}px ${COL_TUNNEL}px ${COL_DATABASE}px`;
const TOTAL_WIDTH =
  COL_USER + GAP + COL_TUNNEL + GAP + COL_NEXTJS + GAP + COL_TUNNEL + GAP + COL_DATABASE;

/** Scale factor for animation speed. 1 = normal, > 1 = slower (e.g. 1.25 = 25% slower). */
const ANIMATION_SPEED_SCALE = 1.25;

type SlotName = "userUser" | "userLlm" | "nextjsUser" | "nextjsLlm" | "database" | "databaseUser" | "databaseLlm" | "llm";
type SlotPosition = { x: number; y: number };

const FALLBACK_SLOTS: Record<SlotName, SlotPosition> = {
  userUser: { x: 13, y: 25 },
  userLlm: { x: 13, y: 33 },
  nextjsUser: { x: 48, y: 25 },
  nextjsLlm: { x: 48, y: 33 },
  database: { x: 90, y: 29 },
  databaseUser: { x: 90, y: 24 },
  databaseLlm: { x: 90, y: 34 },
  llm: { x: 48, y: 72 },
};

export function PipelineAnimation({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const userUserAnchorRef = useRef<HTMLDivElement>(null);
  const userLlmAnchorRef = useRef<HTMLDivElement>(null);
  const nextjsUserAnchorRef = useRef<HTMLDivElement>(null);
  const nextjsLlmAnchorRef = useRef<HTMLDivElement>(null);
  const databaseAnchorRef = useRef<HTMLDivElement>(null);
  const dbUserSlotRef = useRef<HTMLDivElement>(null);
  const dbLlmSlotRef = useRef<HTMLDivElement>(null);
  const llmAnchorRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Record<SlotName, SlotPosition>>(FALLBACK_SLOTS);

  const userMsgSlot = useAnimation();
  const msgToLlmSlot = useAnimation();
  const toDbSlot = useAnimation();
  const finalToDbSlot = useAnimation();
  const chunk1Slot = useAnimation();
  const chunk2Slot = useAnimation();
  const chunk3Slot = useAnimation();
  const nextJsAccum1 = useAnimation();
  const nextJsAccum2 = useAnimation();
  const nextJsAccum3 = useAnimation();
  const userAccum1 = useAnimation();
  const userAccum2 = useAnimation();
  const userAccum3 = useAnimation();
  const nextJsLlmContainerVis = useAnimation();
  const userLlmContainerVis = useAnimation();

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const getSlotPosition = (element: HTMLElement | null): SlotPosition | null => {
      if (!element) return null;
      const stageRect = stage.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      if (stageRect.width === 0 || stageRect.height === 0) return null;

      return {
        x: ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * 100,
        y: ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * 100,
      };
    };

    const measure = () => {
      const nextSlots = {
        userUser: getSlotPosition(userUserAnchorRef.current),
        userLlm: getSlotPosition(userLlmAnchorRef.current),
        nextjsUser: getSlotPosition(nextjsUserAnchorRef.current),
        nextjsLlm: getSlotPosition(nextjsLlmAnchorRef.current),
        database: getSlotPosition(databaseAnchorRef.current),
        databaseUser: getSlotPosition(dbUserSlotRef.current),
        databaseLlm: getSlotPosition(dbLlmSlotRef.current),
        llm: getSlotPosition(llmAnchorRef.current),
      };

      if (Object.values(nextSlots).some((slot) => slot === null)) return;

      setSlots((prev) => {
        const measured = nextSlots as Record<SlotName, SlotPosition>;
        const changed = (Object.keys(measured) as SlotName[]).some((key) => {
          const prevSlot = prev[key];
          const nextSlot = measured[key];
          return (
            Math.abs(prevSlot.x - nextSlot.x) > 0.1 ||
            Math.abs(prevSlot.y - nextSlot.y) > 0.1
          );
        });

        return changed ? measured : prev;
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(stage);
    if (userUserAnchorRef.current) resizeObserver.observe(userUserAnchorRef.current);
    if (userLlmAnchorRef.current) resizeObserver.observe(userLlmAnchorRef.current);
    if (nextjsUserAnchorRef.current) resizeObserver.observe(nextjsUserAnchorRef.current);
    if (nextjsLlmAnchorRef.current) resizeObserver.observe(nextjsLlmAnchorRef.current);
    if (databaseAnchorRef.current) resizeObserver.observe(databaseAnchorRef.current);
    if (dbUserSlotRef.current) resizeObserver.observe(dbUserSlotRef.current);
    if (dbLlmSlotRef.current) resizeObserver.observe(dbLlmSlotRef.current);
    if (llmAnchorRef.current) resizeObserver.observe(llmAnchorRef.current);

    window.addEventListener("resize", measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const scale = (n: number) => n * ANIMATION_SPEED_SCALE;

    const sleep = async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    };

    const toSlot = (slot: SlotName, yOffsetPercent = 0) => {
      const { x, y } = slots[slot];
      return { left: `${x}%`, top: `${y + yOffsetPercent}%`, opacity: 1, transition: { duration: scale(0.01) } };
    };
    const fromSlot = (slot: SlotName) => {
      const { x, y } = slots[slot];
      return { left: `${x}%`, top: `${y}%` };
    };
    const run = async () => {
      while (!cancelled) {
        // 1. User message appears in user slot
        await userMsgSlot.set({ ...fromSlot("userUser"), opacity: 0 });
        await userMsgSlot.start({ ...toSlot("userUser"), transition: { duration: scale(0.4) } });
        await sleep(scale(600));
        if (cancelled) break;

        // 2. Move to nextjs slot (through tunnel 1)
        await userMsgSlot.start({
          ...toSlot("nextjsUser"),
          transition: { duration: scale(1.2), ease: "easeInOut" },
        });
        await sleep(scale(300));
        if (cancelled) break;

        // 3. User message stays at server. Copy goes to Cloud LLM and encrypted user message goes to DB (simultaneously)
        await msgToLlmSlot.set({ ...fromSlot("nextjsUser"), opacity: 0 });
        await msgToLlmSlot.start({ ...toSlot("nextjsUser"), transition: { duration: scale(0.2) } });
        await toDbSlot.set({ ...fromSlot("nextjsUser"), opacity: 0 });
        await toDbSlot.start({ ...toSlot("nextjsUser"), transition: { duration: scale(0.2) } });
        await userMsgSlot.start({ opacity: 0, transition: { duration: scale(0.2) } });
        await sleep(scale(250));
        if (cancelled) break;
        await Promise.all([
          msgToLlmSlot.start({
            ...toSlot("llm"),
            transition: { duration: scale(0.9), ease: "easeInOut" },
          }),
          toDbSlot.start({
            ...toSlot("databaseUser"),
            transition: { duration: scale(1), ease: "easeInOut" },
          }),
        ]);
        await sleep(scale(900));
        if (cancelled) break;
        await msgToLlmSlot.start({ opacity: 0 });
        await sleep(scale(400));
        if (cancelled) break;

        // 4. Chunks from LLM to Next.js (same components move LLM → Next.js → User) (z-index under compiled message)
        await chunk1Slot.set({ ...fromSlot("llm"), opacity: 0 });
        await chunk1Slot.start({ ...toSlot("llm"), transition: { duration: scale(0.2) } });
        await chunk1Slot.start({
          ...toSlot("nextjsLlm"),
          transition: { duration: scale(0.6), ease: "easeInOut" },
        });
        await nextJsLlmContainerVis.start({ opacity: 1 });
        await nextJsAccum1.start({ opacity: 1 });
        await chunk1Slot.start({
          ...toSlot("userLlm"),
          transition: { duration: scale(0.7), ease: "linear" },
        });
        await chunk1Slot.start({ opacity: 0 });
        await userLlmContainerVis.start({ opacity: 1 });
        await userAccum1.start({ opacity: 1 });

        await chunk2Slot.set({ ...fromSlot("llm"), opacity: 0 });
        await chunk2Slot.start({ ...toSlot("llm"), transition: { duration: scale(0.2) } });
        await chunk2Slot.start({
          ...toSlot("nextjsLlm"),
          transition: { duration: scale(0.5), ease: "easeInOut" },
        });
        await nextJsAccum2.start({ opacity: 1 });
        await chunk2Slot.start({
          ...toSlot("userLlm"),
          transition: { duration: scale(0.6), ease: "linear" },
        });
        await chunk2Slot.start({ opacity: 0 });
        await userAccum2.start({ opacity: 1 });

        await chunk3Slot.set({ ...fromSlot("llm"), opacity: 0 });
        await chunk3Slot.start({ ...toSlot("llm"), transition: { duration: scale(0.2) } });
        await chunk3Slot.start({
          ...toSlot("nextjsLlm"),
          transition: { duration: scale(0.5), ease: "easeInOut" },
        });
        await nextJsAccum3.start({ opacity: 1 });
        await chunk3Slot.start({
          ...toSlot("userLlm"),
          transition: { duration: scale(0.6), ease: "linear" },
        });
        await chunk3Slot.start({ opacity: 0 });
        await userAccum3.start({ opacity: 1 });
        await sleep(scale(400));
        if (cancelled) break;

        // 7. Final → DB: encrypted payload appears over message slot, placeholder disappears, then moves to DB
        await finalToDbSlot.set({ ...fromSlot("nextjsLlm"), opacity: 0 });
        await finalToDbSlot.start({ ...toSlot("nextjsLlm"), transition: { duration: scale(0.2) } });
        await sleep(scale(400));
        if (cancelled) break;
        await nextJsAccum1.start({ opacity: 0 });
        await nextJsAccum2.start({ opacity: 0 });
        await nextJsAccum3.start({ opacity: 0 });
        await nextJsLlmContainerVis.start({ opacity: 0 });
        await sleep(scale(200));
        if (cancelled) break;
        await finalToDbSlot.start({
          ...toSlot("databaseLlm"),
          transition: { duration: scale(1), ease: "easeInOut" },
        });
        await sleep(scale(1500));
        if (cancelled) break;
        await sleep(scale(1200));
        if (cancelled) break;

        // Reset
        await userMsgSlot.set({ ...fromSlot("userUser"), opacity: 0 });
        await msgToLlmSlot.set({ ...fromSlot("nextjsUser"), opacity: 0 });
        await toDbSlot.set({ ...fromSlot("nextjsUser"), opacity: 0 });
        await finalToDbSlot.set({ ...fromSlot("nextjsLlm"), opacity: 0 });
        await chunk1Slot.set({ ...fromSlot("llm"), opacity: 0 });
        await chunk2Slot.set({ ...fromSlot("llm"), opacity: 0 });
        await chunk3Slot.set({ ...fromSlot("llm"), opacity: 0 });
        await nextJsAccum1.start({ opacity: 0 });
        await nextJsAccum2.start({ opacity: 0 });
        await nextJsAccum3.start({ opacity: 0 });
        await nextJsLlmContainerVis.start({ opacity: 0 });
        await userAccum1.start({ opacity: 0 });
        await userAccum2.start({ opacity: 0 });
        await userAccum3.start({ opacity: 0 });
        await userLlmContainerVis.start({ opacity: 0 });
        await sleep(scale(3200));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    slots,
    userMsgSlot,
    msgToLlmSlot,
    toDbSlot,
    finalToDbSlot,
    chunk1Slot,
    chunk2Slot,
    chunk3Slot,
    nextJsAccum1,
    nextJsAccum2,
    nextJsAccum3,
    userAccum1,
    userAccum2,
    userAccum3,
    nextJsLlmContainerVis,
    userLlmContainerVis,
  ]);

  return (
    <div
      className={cn(
        "my-6 relative overflow-visible rounded-xl border border-border/50 bg-muted/10 p-5",
        className,
      )}
      role="figure"
      aria-label="Animated end-to-end pipeline"
    >
      <div
        ref={stageRef}
        className="relative mx-auto overflow-visible"
        style={{ width: TOTAL_WIDTH, maxWidth: "100%", minHeight: FIGURE_HEIGHT }}
      >
        {/* Overlay: moving elements animate between measured anchor points. */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-visible">
          <motion.div
            animate={userMsgSlot}
            initial={{ left: `${slots.userUser.x}%`, top: `${slots.userUser.y}%`, opacity: 0 }}
            className="absolute z-20 rounded-2xl rounded-br-md px-4 py-2.5 text-xs font-medium bg-primary text-primary-foreground shadow-md -translate-x-1/2 -translate-y-1/2"
          >
            Hello
          </motion.div>
          <motion.div
            animate={msgToLlmSlot}
            initial={{ left: `${slots.nextjsUser.x}%`, top: `${slots.nextjsUser.y}%`, opacity: 0 }}
            className="absolute z-20 rounded-2xl rounded-bl-md px-4 py-2.5 text-xs font-medium bg-primary text-primary-foreground shadow-md -translate-x-1/2 -translate-y-1/2"
          >
            Hello
          </motion.div>
          <motion.div
            animate={chunk1Slot}
            initial={{ left: `${slots.llm.x}%`, top: `${slots.llm.y}%`, opacity: 0 }}
            className="absolute z-10 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] -translate-x-1/2 -translate-y-1/2"
          >
            Hi
          </motion.div>
          <motion.div
            animate={chunk2Slot}
            initial={{ left: `${slots.llm.x}%`, top: `${slots.llm.y}%`, opacity: 0 }}
            className="absolute z-10 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] -translate-x-1/2 -translate-y-1/2"
          >
            there
          </motion.div>
          <motion.div
            animate={chunk3Slot}
            initial={{ left: `${slots.llm.x}%`, top: `${slots.llm.y}%`, opacity: 0 }}
            className="absolute z-10 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] -translate-x-1/2 -translate-y-1/2"
          >
            !
          </motion.div>
        </div>

        {/* Encrypt overlay: toDbSlot and finalToDbSlot paint over the grid so they appear over the message slot */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
          <motion.div
            animate={toDbSlot}
            initial={{ left: `${slots.nextjsUser.x}%`, top: `${slots.nextjsUser.y}%`, opacity: 0 }}
            className="absolute rounded border border-amber-600/50 bg-amber-500/15 backdrop-blur-sm px-3 py-1.5 text-[10px] text-foreground flex flex-col items-center gap-0.5 w-[140px] min-w-[140px] box-border -translate-x-1/2 -translate-y-1/2"
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden>🔒</span> User
            </span>
            <span className="text-[8px] italic text-muted-foreground">AES-256-GCM encryption</span>
          </motion.div>
          <motion.div
            animate={finalToDbSlot}
            initial={{ left: `${slots.nextjsLlm.x}%`, top: `${slots.nextjsLlm.y}%`, opacity: 0 }}
            className="absolute rounded border border-amber-600/50 bg-amber-500/15 backdrop-blur-sm px-3 py-1.5 text-[10px] text-foreground flex flex-col items-center gap-0.5 w-[140px] min-w-[140px] box-border -translate-x-1/2 -translate-y-1/2"
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden>🔒</span> LLM
            </span>
            <span className="text-[8px] italic text-muted-foreground">AES-256-GCM encryption</span>
          </motion.div>
        </div>

        {/* Static grid: boundaries and tunnels; z-10 so compiled message (accum) paints above overlay stream chunks */}
        <div
          className="grid gap-x-2 gap-y-1 overflow-visible relative z-10"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          {/* Row 1 */}
          <div className={cn(BOUNDARY_STYLE, "w-[152px] relative z-10")}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              User
            </span>
            <div className="mt-2 flex flex-col gap-2 min-h-[48px]">
              <div
                ref={userUserAnchorRef}
                className="h-8 flex items-center shrink-0"
                aria-hidden
              />
              <motion.div
                animate={userLlmContainerVis}
                initial={{ opacity: 0 }}
                className="w-fit self-start"
              >
                <div
                  ref={userLlmAnchorRef}
                  className="rounded-2xl rounded-bl-md px-4 py-2.5 text-xs font-medium bg-muted border border-border/60 shadow-md min-w-26 z-20"
                >
                  <motion.span animate={userAccum1} initial={{ opacity: 0 }}>Hi</motion.span>
                  <motion.span animate={userAccum2} initial={{ opacity: 0 }}> there</motion.span>
                  <motion.span animate={userAccum3} initial={{ opacity: 0 }}>!</motion.span>
                </div>
              </motion.div>
            </div>
          </div>

          <div className={cn(TUNNEL_STYLE, "w-[70px]")}>
            <span className="text-[10px] text-muted-foreground relative z-10">
              TLS
            </span>
          </div>

          <div className={cn(BOUNDARY_STYLE, "relative w-[192px] overflow-visible z-10")}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Next.js server
            </span>
            <div className="mt-2 flex flex-col gap-2 min-h-[60px]">
              <div
                ref={nextjsUserAnchorRef}
                className="h-8 flex items-center shrink-0"
                aria-hidden
              />
              <motion.div
                animate={nextJsLlmContainerVis}
                initial={{ opacity: 0 }}
                className="w-fit self-start"
              >
                <div
                  ref={nextjsLlmAnchorRef}
                  className="rounded-2xl rounded-bl-md px-4 py-2.5 text-xs font-medium bg-muted border border-border/60 shadow-md min-w-26 z-20"
                >
                  <motion.span animate={nextJsAccum1} initial={{ opacity: 0 }}>Hi</motion.span>
                  <motion.span animate={nextJsAccum2} initial={{ opacity: 0 }}> there</motion.span>
                  <motion.span animate={nextJsAccum3} initial={{ opacity: 0 }}>!</motion.span>
                </div>
              </motion.div>
            </div>
          </div>

          <div className={cn(TUNNEL_STYLE, "w-[70px]")}>
            <span className="text-[10px] text-muted-foreground relative z-10">
              TLS
            </span>
          </div>

          <div className={cn(BOUNDARY_STYLE, "w-[168px] relative")}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Database
            </span>
            <span className="mt-1 text-[10px] text-muted-foreground">
              Supabase
            </span>
            <div className="mt-2 flex flex-col gap-2">
              <div
                ref={dbUserSlotRef}
                className="h-6 flex items-center justify-center"
                aria-hidden
              />
              <div
                ref={dbLlmSlotRef}
                className="h-6 flex items-center justify-center"
                aria-hidden
              />
            </div>
            <div
              ref={databaseAnchorRef}
              className="absolute left-1/2 top-[56%] h-0 w-0 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden
            />
          </div>

          {/* Row 2: connector + TLS boundary + Cloud LLM */}
          <div className="col-span-2" />
          <div className="relative flex flex-col items-center">
            <div
              className="w-0 h-4 border-l-2 border-dashed border-border/50 -mb-px shrink-0"
              aria-hidden
            />
            <div
              className={cn(
                TUNNEL_STYLE,
                "w-full min-h-[32px] py-2 pt-0 justify-center",
              )}
            >
              <span className="text-[10px] text-muted-foreground relative z-10">
                TLS
              </span>
            </div>
            <div
              className="w-0 h-4 border-l-2 border-dashed border-border/50 -mb-px shrink-0"
              aria-hidden
            />
            <div
              className={cn(
                BOUNDARY_STYLE,
                "w-full min-h-[72px] relative overflow-visible",
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cloud LLM
              </span>
              <div className="relative mt-2 min-h-[54px]">
                <div
                  ref={llmAnchorRef}
                  className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2"
                  aria-hidden
                />
              </div>
            </div>
          </div>
          <div className="col-span-2" />
        </div>
      </div>
    </div>
  );
}

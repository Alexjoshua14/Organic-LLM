"use client";

import type { CSSProperties, PointerEvent } from "react";
import type { ActivityGlassByState } from "@/components/agents/organic-activity-mark";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { useHydrated } from "./use-hydrated";
import styles from "./welcome-specimen.module.css";
import { specimenPaneTransform } from "./welcome-specimen-projection";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import sceneLight from "@/public/images/welcome/living-specimen-scene-light.webp";
import sceneDark from "@/public/images/welcome/living-specimen-scene-dark.webp";
import sceneMobileLight from "@/public/images/welcome/living-specimen-scene-mobile-light.webp";
import sceneMobileDark from "@/public/images/welcome/living-specimen-scene-mobile-dark.webp";

const PARALLAX_DISTANCE_PX = 5;
const PARALLAX_SPRING = { stiffness: 180, damping: 32, mass: 1 };
const SCROLL_PERSPECTIVE = { tiltDegrees: 2.4, travelPx: 18 };
const SPECIMEN_GLASS: ActivityGlassByState = {
  idle: { opacity: 0, blur: 5.5, brightness: 1, tint: "#eeebe6" },
};
const PANE_TRANSFORMS = {
  "--specimen-pane-desktop-light": specimenPaneTransform(false),
  "--specimen-pane-desktop-dark": specimenPaneTransform(false, true),
  "--specimen-pane-mobile-light": specimenPaneTransform(true),
  "--specimen-pane-mobile-dark": specimenPaneTransform(true, true),
};

/** Photographic glass and light surround the same live mark used by the agents. */
export function WelcomeSpecimen() {
  const reduce = useReducedMotion();
  // The server cannot read reduced motion; attach camera motion after hydration.
  const cameraMotion = useHydrated() && !reduce;
  const materialId = `welcome-dot-${useId().replace(/:/g, "")}`;
  const sceneRef = useRef<HTMLElement>(null);
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, PARALLAX_SPRING);
  const pointerY = useSpring(targetY, PARALLAX_SPRING);
  const scrollProgress = useMotionValue(0);
  const rotateX = useTransform(scrollProgress, [0, 1], [0, SCROLL_PERSPECTIVE.tiltDegrees]);
  const scrollY = useTransform(scrollProgress, [0, 1], [0, -SCROLL_PERSPECTIVE.travelPx]);
  const y = useTransform(
    [pointerY, scrollY],
    ([pointer, scroll]) => Number(pointer) + Number(scroll)
  );

  useEffect(() => {
    if (reduce) return;
    const scroller = sceneRef.current?.closest<HTMLElement>("[data-page-chrome]");
    const hero = sceneRef.current?.parentElement;

    if (!scroller || !hero) return;

    const sync = () =>
      scrollProgress.set(Math.min(1, Math.max(0, scroller.scrollTop / hero.offsetHeight)));

    sync();
    scroller.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);

    observer.observe(hero);

    return () => {
      scroller.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [reduce, scrollProgress]);

  const move = (event: PointerEvent<HTMLElement>) => {
    if (reduce || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();

    targetX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * PARALLAX_DISTANCE_PX);
    targetY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * PARALLAX_DISTANCE_PX);
  };
  const reset = () => {
    targetX.set(0);
    targetY.set(0);
  };

  return (
    <figure
      ref={sceneRef}
      className={styles.scene}
      style={
        {
          ...PANE_TRANSFORMS,
          "--specimen-dot-fill-light": `url(#${materialId}-light)`,
          "--specimen-dot-fill-dark": `url(#${materialId}-dark)`,
        } as CSSProperties
      }
      aria-hidden
      onPointerMove={move}
      onPointerLeave={reset}
    >
      <svg className={styles.materialDefinitions} aria-hidden focusable="false">
        <defs>
          <radialGradient id={`${materialId}-light`} cx="32%" cy="24%" r="76%">
            <stop offset="0" stopColor="#343435" />
            <stop offset="0.34" stopColor="#2b2b2c" />
            <stop offset="0.72" stopColor="#272627" />
            <stop offset="1" stopColor="#232324" />
          </radialGradient>
          <radialGradient id={`${materialId}-dark`} cx="32%" cy="24%" r="76%">
            <stop offset="0" stopColor="#f4f3ef" />
            <stop offset="0.34" stopColor="#eeedeb" />
            <stop offset="0.72" stopColor="#e7e8e6" />
            <stop offset="1" stopColor="#dedfdd" />
          </radialGradient>
        </defs>
      </svg>
      <motion.div className={styles.camera} style={cameraMotion ? { x, y, rotateX } : undefined}>
        <div className={styles.canvas}>
          <picture className={styles.sceneLight}>
            <source
              media="(max-width: 767px) and (orientation: portrait)"
              srcSet={sceneMobileLight.src}
            />
            <Image
              src={sceneLight}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 767px) 100vw, min(100vw, 140vh)"
              loading="eager"
              fetchPriority="high"
              className={styles.sceneImage}
              draggable={false}
            />
          </picture>
          <picture className={styles.sceneDark}>
            <source
              media="(max-width: 767px) and (orientation: portrait)"
              srcSet={sceneMobileDark.src}
            />
            <Image
              src={sceneDark}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 767px) 100vw, min(100vw, 140vh)"
              loading="eager"
              className={styles.sceneImage}
              draggable={false}
            />
          </picture>
          <div className={styles.pane}>
            <div className={styles.markAnchor}>
              <OrganicActivityMark
                state="idle"
                seed="organic-homepage-specimen"
                glassByState={SPECIMEN_GLASS}
                glassDistortion={false}
                className={styles.mark}
              />
            </div>
            <div
              className={`organic-activity-grain ${styles.paneGrain}`}
              data-specimen-layer="grain"
            />
          </div>
        </div>
      </motion.div>
    </figure>
  );
}

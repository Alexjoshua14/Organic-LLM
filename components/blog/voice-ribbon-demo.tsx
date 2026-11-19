"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BlogFigure } from "./blog-figure";

import {
  VOICE_BAR_HEIGHT_PX,
  VOICE_WAVE_DRIVERS,
  VOICE_WAVE_STROKE_WIDTH,
  type VoiceWaveDriver,
} from "@/components/voice/voice-live-bar-timing";
import {
  buildRibbonCurves,
  ribbonCurveCount,
  toSmoothPath,
  type WaveLevels,
} from "@/lib/speak/waveform-geometry";

/** Internal viewBox width, as in the live bar. Real width comes from CSS. */
const VIEWBOX_WIDTH = 600;

const DRIVER_LABEL: Record<VoiceWaveDriver, string> = {
  volume: "Volume",
  treble: "Treble",
  bass: "Bass",
};

const PRESETS: ReadonlyArray<{ label: string; levels: WaveLevels }> = [
  { label: "Quiet", levels: { volume: 0.05, treble: 0.05, bass: 0.05 } },
  { label: "Talking", levels: { volume: 0.55, treble: 0.4, bass: 0.35 } },
  { label: "Loud", levels: { volume: 0.95, treble: 0.8, bass: 0.9 } },
];

/**
 * The live voice bar's ribbon, driven by sliders instead of a microphone. It calls the same
 * geometry the product does (`buildRibbonCurves`, `toSmoothPath`), writing path data straight to
 * the DOM each frame so React never re-renders at animation rate. No audio is captured or played.
 */
export function VoiceRibbonDemo() {
  const [levels, setLevels] = useState<WaveLevels>(PRESETS[0].levels);
  const levelsRef = useRef(levels);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const curveCount = useMemo(() => ribbonCurveCount(), []);

  levelsRef.current = levels;

  const drawRef = useRef<(seconds: number) => void>(() => {});

  drawRef.current = (seconds: number) => {
    const curves = buildRibbonCurves(levelsRef.current, seconds, VOICE_BAR_HEIGHT_PX);

    curves.forEach((curve, i) => {
      const el = pathRefs.current[i];

      if (!el) return;
      el.setAttribute("d", toSmoothPath(curve.ys, VIEWBOX_WIDTH));
      el.setAttribute("stroke-opacity", curve.opacity.toFixed(3));
    });
  };

  // Animated: one frame loop for the life of the figure. Slider moves are read from a ref, so the
  // loop never restarts and the drift never jumps.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      drawRef.current((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, []);

  // Reduced motion: one still frame, redrawn when a slider moves, so nothing animates.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) drawRef.current(0);
  }, [levels]);

  return (
    <BlogFigure caption="The real ribbon geometry, driven by sliders. No microphone, no audio.">
      <div className="space-y-stack-xl rounded-xl border border-border bg-secondary/40 p-inset-xl">
        <div className="rounded-lg border border-border/60 bg-background/60 px-inset-lg py-stack-lg text-foreground/80">
          <svg
            aria-hidden
            className="block h-20 w-full"
            preserveAspectRatio="none"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VOICE_BAR_HEIGHT_PX}`}
          >
            <g fill="none" stroke="currentColor">
              {Array.from({ length: curveCount }, (_, i) => (
                <path
                  key={i}
                  ref={(el) => {
                    pathRefs.current[i] = el;
                  }}
                  strokeLinecap="round"
                  strokeWidth={VOICE_WAVE_STROKE_WIDTH}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          </svg>
        </div>

        <div className="flex flex-wrap gap-inline-sm" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="organic-focus rounded-full border border-border px-inset-lg py-stack-sm text-sm text-muted-foreground transition-colors hover:text-foreground"
              type="button"
              onClick={() => setLevels(p.levels)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-stack-lg @xl:grid-cols-3 @xl:gap-inline-lg">
          {VOICE_WAVE_DRIVERS.map((d) => (
            <label key={d} className="block text-sm text-foreground">
              <span className="mb-stack-sm flex justify-between text-xs text-muted-foreground">
                {DRIVER_LABEL[d]}
                <span className="tabular-nums">{Math.round(levels[d] * 100)}%</span>
              </span>
              <input
                className="organic-focus h-2 w-full cursor-pointer accent-lumen-deep"
                max={1}
                min={0}
                step={0.01}
                type="range"
                value={levels[d]}
                onChange={(e) => setLevels((l) => ({ ...l, [d]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
      </div>
    </BlogFigure>
  );
}

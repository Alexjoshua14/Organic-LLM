"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  VOICE_BAR_HEIGHT_PX,
  VOICE_WAVE_STROKE_WIDTH,
} from "./voice-live-bar-timing";

import { useVoiceAudioLevels } from "@/hooks/use-voice-audio-levels";
import {
  buildRibbonCurves,
  ribbonCurveCount,
  toSmoothPath,
} from "@/lib/speak/waveform-geometry";
import { cn } from "@/lib/utils";

/** Internal viewBox width. Real width comes from CSS; the SVG scales non-uniformly to fit. */
const VIEWBOX_WIDTH = 600;

export type VoiceWaveformProps = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Pauses the frame loop — used when the tab is hidden or motion is reduced. */
  paused?: boolean;
  className?: string;
};

/**
 * The ribbon.
 *
 * Every frame: read three scalars off the analyser, rebuild the curve set, write `d` straight to
 * the path elements. React renders the `<path>` list exactly once — the count is a compile-time
 * constant, so there is nothing for it to reconcile afterwards. Going through state here would
 * re-render the provider (and therefore the app) sixty times a second.
 */
export function VoiceWaveform({
  localStream,
  remoteStream,
  paused = false,
  className,
}: VoiceWaveformProps) {
  const readLevels = useVoiceAudioLevels({ local: localStream, remote: remoteStream });
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const curveCount = useMemo(() => ribbonCurveCount(), []);

  useEffect(() => {
    if (paused) return;

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const seconds = (now - start) / 1000;
      const levels = readLevels();
      const curves = buildRibbonCurves(levels, seconds, VOICE_BAR_HEIGHT_PX);

      for (let i = 0; i < curves.length; i++) {
        const el = pathRefs.current[i];

        if (!el) continue;

        el.setAttribute("d", toSmoothPath(curves[i]!.ys, VIEWBOX_WIDTH));
        el.setAttribute("stroke-opacity", curves[i]!.opacity.toFixed(3));
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, [paused, readLevels]);

  return (
    <svg
      aria-hidden="true"
      className={cn("h-full w-full", className)}
      preserveAspectRatio="none"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VOICE_BAR_HEIGHT_PX}`}
    >
      <defs>
        {/*
          The reference art fades each ribbon along its length rather than ending it abruptly.
          Applied as a stroke mask so it costs one gradient for all curves, not one per curve.
        */}
        <linearGradient id="voice-wave-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="14%" stopColor="white" stopOpacity="1" />
          <stop offset="86%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="voice-wave-mask">
          <rect fill="url(#voice-wave-fade)" height={VOICE_BAR_HEIGHT_PX} width={VIEWBOX_WIDTH} />
        </mask>
      </defs>

      <g fill="none" mask="url(#voice-wave-mask)" stroke="currentColor">
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
  );
}

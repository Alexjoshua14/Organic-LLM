"use client";

import { useEffect, useRef, useState } from "react";

import { useSyntheticVoiceStream } from "./synthetic-voice-stream";

import { VoiceElapsed } from "@/components/voice/voice-elapsed";
import { VoiceBarSurface } from "@/components/voice/voice-bar-surface";
import { VOICE_BAR_HEIGHT_PX } from "@/components/voice/voice-live-bar-timing";
import { VoiceWaveform } from "@/components/voice/voice-waveform";
import { ribbonCurveCount } from "@/lib/speak/waveform-geometry";

/** Rolling window for the frame statistics, ~2s at 60fps. */
const SAMPLE_WINDOW = 120;
/** Readout refresh. Faster than this and the numbers are unreadable. */
const FLUSH_MS = 250;

type Stats = { fps: number; meanMs: number; p95Ms: number; longTasks: number; heapMb: number | null };

/**
 * Main-thread frame sampler.
 *
 * Deliberately outside R3F: the question this lab answers is "what does the bar cost the page",
 * and the page's rAF is where jank would actually be felt. Long tasks are counted separately
 * because a 55fps average with one 180ms stall is a very different experience from a steady 55.
 */
function useFrameStats(active: boolean): Stats {
  const [stats, setStats] = useState<Stats>({
    fps: 0,
    meanMs: 0,
    p95Ms: 0,
    longTasks: 0,
    heapMb: null,
  });
  const longTasksRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    longTasksRef.current = 0;

    let observer: PerformanceObserver | undefined;

    try {
      observer = new PerformanceObserver((list) => {
        longTasksRef.current += list.getEntries().length;
      });
      observer.observe({ type: "longtask", buffered: false });
    } catch {
      // Safari does not implement longtask; the other numbers still stand.
    }

    const samples: number[] = [];
    let last = performance.now();
    let flushAt = last + FLUSH_MS;
    let raf = requestAnimationFrame(function frame(now: number) {
      samples.push(now - last);
      if (samples.length > SAMPLE_WINDOW) samples.shift();
      last = now;

      if (now >= flushAt) {
        flushAt = now + FLUSH_MS;

        const sorted = [...samples].sort((a, b) => a - b);
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;

        setStats({
          fps: mean > 0 ? 1000 / mean : 0,
          meanMs: mean,
          p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? mean,
          longTasks: longTasksRef.current,
          heapMb: memory ? memory.usedJSHeapSize / 1024 / 1024 : null,
        });
      }

      raf = requestAnimationFrame(frame);
    });

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [active]);

  return stats;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-background/30 p-3">
      <input
        aria-label={label}
        checked={checked}
        className="mt-1 size-4 accent-[var(--color-accent)]"
        type="checkbox"
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function Readout({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/30 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-light tabular-nums text-foreground">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/**
 * Isolates each layer of the live bar so its cost can be attributed rather than guessed.
 *
 * Toggle one layer at a time and read the delta. The numbers recorded in the live-bar ADR came
 * from exactly this page.
 */
export function VoiceBarLab() {
  const [waveform, setWaveform] = useState(true);
  const [glow, setGlow] = useState(true);
  const [fluidGlass, setFluidGlass] = useState(true);
  const [audio, setAudio] = useState(true);
  const [measuring, setMeasuring] = useState(true);

  const stream = useSyntheticVoiceStream(audio);
  const stats = useFrameStats(measuring);

  // Fixed anchor so the elapsed clock shows a realistic mid-minute glow rather than starting cold.
  const [startedAt] = useState(() => Date.now() - 9 * 60_000 - 37_000);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.26em] text-accent/80">Voice bar lab</p>
        <h1 className="mt-2 text-2xl font-light tracking-tight text-foreground">
          Layer-by-layer cost of the live voice bar
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          The bar is on screen for the whole call, so every layer has to justify itself. Toggle one
          at a time and read the delta in mean frame time. The ribbon currently draws{" "}
          <span className="font-mono text-foreground/90">{ribbonCurveCount()}</span> stroked paths
          per frame.
        </p>
      </header>

      {/* Same surface as production: FluidGlass only, CSS glass solely as the fallback. */}
      <div
        className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3"
        style={{ height: VOICE_BAR_HEIGHT_PX }}
      >
        <VoiceBarSurface glass={fluidGlass} />
        <div className="relative min-w-0 flex-1 self-stretch text-foreground/70">
          {waveform ? (
            <VoiceWaveform localStream={stream} remoteStream={null} />
          ) : (
            <span className="text-2xs text-muted-foreground">waveform off</span>
          )}
        </div>
        {glow ? <VoiceElapsed className="relative shrink-0 text-2xs" startedAt={startedAt} /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle
          checked={waveform}
          hint={`${ribbonCurveCount()} SVG paths rebuilt and re-stringified every frame.`}
          label="Waveform ribbon"
          onChange={setWaveform}
        />
        <Toggle
          checked={glow}
          hint="morph-physics spring on the Lumen glow. Runs only while unsettled."
          label="Elapsed glow (morph-physics)"
          onChange={setGlow}
        />
        <Toggle
          checked={fluidGlass}
          hint="3D glass refracting the real LiquidChrome behind it, capped at 30fps. Off shows the no-WebGL2 fallback."
          label="FluidGlass"
          onChange={setFluidGlass}
        />
        <Toggle
          checked={audio}
          hint="Synthetic speech-like stream driving the analyser."
          label="Audio source"
          onChange={setAudio}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Readout label="FPS" note="main thread" value={stats.fps.toFixed(1)} />
        <Readout label="Mean frame" note="milliseconds" value={stats.meanMs.toFixed(2)} />
        <Readout label="p95 frame" note="milliseconds" value={stats.p95Ms.toFixed(2)} />
        <Readout
          label="Long tasks"
          note="&gt;50ms, since toggle"
          value={String(stats.longTasks)}
        />
      </div>

      {stats.heapMb !== null ? (
        <Readout label="JS heap" note="Chromium only" value={`${stats.heapMb.toFixed(1)} MB`} />
      ) : null}

      <button
        className="rounded-full border border-white/20 bg-background/40 px-4 py-2 text-sm text-foreground transition hover:border-accent/30"
        type="button"
        onClick={() => setMeasuring((m) => !m)}
      >
        {measuring ? "Pause sampling" : "Resume sampling"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * A fake "voice" for the lab: two detuned oscillators through an LFO-modulated gain, rendered to
 * a `MediaStream`.
 *
 * The bar's analyser does not care where audio comes from, so this exercises the real
 * `useVoiceAudioLevels` → `buildRibbonCurves` → path-write pipeline at realistic levels without
 * needing a Realtime session, a microphone, or any spend.
 */
export function useSyntheticVoiceStream(enabled: boolean): MediaStream | null {
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStream(null);

      return;
    }

    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!Ctor) return;

    const context = new Ctor();
    const destination = context.createMediaStreamDestination();
    const gain = context.createGain();

    gain.gain.value = 0;
    gain.connect(destination);

    // Speech-ish: a low fundamental plus a bright partial, so bass and treble both move.
    const fundamental = context.createOscillator();
    const partial = context.createOscillator();

    fundamental.frequency.value = 130;
    partial.frequency.value = 2_400;
    partial.type = "sawtooth";

    const partialGain = context.createGain();

    partialGain.gain.value = 0.35;
    partial.connect(partialGain).connect(gain);
    fundamental.connect(gain);

    // Syllable-rate envelope so the ribbon pulses the way real speech makes it pulse.
    const lfo = context.createOscillator();
    const lfoDepth = context.createGain();

    lfo.frequency.value = 3.2;
    lfoDepth.gain.value = 0.35;
    lfo.connect(lfoDepth).connect(gain.gain);
    gain.gain.value = 0.4;

    fundamental.start();
    partial.start();
    lfo.start();

    setStream(destination.stream);

    return () => {
      fundamental.stop();
      partial.stop();
      lfo.stop();
      void context.close().catch(() => undefined);
      setStream(null);
    };
  }, [enabled]);

  return stream;
}

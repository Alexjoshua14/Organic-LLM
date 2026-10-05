"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { initialVoiceDemoModel } from "@/lib/showcase/voice/script";

type SyntheticGraph = {
  stop: () => void;
  stream: MediaStream;
  resume: () => void;
};

/**
 * A fake voice for the showcase bar: two detuned oscillators through an LFO-modulated gain,
 * rendered to a MediaStream. The bar's analyser does not care where audio comes from, so this
 * moves the real waveform without a live session.
 *
 * The context is created inside the opt-in handler — a visitor gesture — and never on load.
 */
function createSyntheticGraph(): SyntheticGraph | null {
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) return null;

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

  return {
    stream: destination.stream,
    resume: () => {
      void context.resume();
    },
    stop: () => {
      try {
        fundamental.stop();
        partial.stop();
        lfo.stop();
      } catch {
        /* already stopped */
      }
      void context.close().catch(() => undefined);
    },
  };
}

export type OptInSyntheticVoice = {
  enabled: boolean;
  stream: MediaStream | null;
  /** Start or stop the graph. Call from the opt-in button so the context can resume. */
  toggle: () => void;
  disable: () => void;
};

export function useOptInSyntheticVoice(): OptInSyntheticVoice {
  const graphRef = useRef<SyntheticGraph | null>(null);
  const [enabled, setEnabled] = useState(initialVoiceDemoModel().audioEnabled);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const disable = useCallback(() => {
    graphRef.current?.stop();
    graphRef.current = null;
    setStream(null);
    setEnabled(false);
  }, []);

  const toggle = useCallback(() => {
    if (graphRef.current) {
      disable();

      return;
    }

    const graph = createSyntheticGraph();

    if (!graph) return;

    graph.resume();
    graphRef.current = graph;
    setStream(graph.stream);
    setEnabled(true);
  }, [disable]);

  useEffect(() => {
    return () => {
      graphRef.current?.stop();
      graphRef.current = null;
    };
  }, []);

  return { enabled, stream, toggle, disable };
}

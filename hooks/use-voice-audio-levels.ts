"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  VOICE_WAVE_BASS_BINS,
  VOICE_WAVE_FFT_SIZE,
  VOICE_WAVE_LEVEL_SMOOTHING,
  VOICE_WAVE_TREBLE_BINS,
} from "@/components/voice/voice-live-bar-timing";

export type VoiceAudioLevels = {
  /** Broadband loudness (time-domain RMS), 0–1. */
  volume: number;
  /** High-band energy, 0–1. */
  treble: number;
  /** Low-band energy, 0–1. */
  bass: number;
};

type Tap = {
  analyser: AnalyserNode;
  freq: Uint8Array;
  time: Uint8Array;
  source: MediaStreamAudioSourceNode;
};

function bandEnergy(freq: Uint8Array, [start, end]: readonly [number, number]): number {
  let sum = 0;

  for (let i = start; i < end && i < freq.length; i++) {
    sum += freq[i]!;
  }

  return sum / ((end - start) * 255);
}

function rms(time: Uint8Array): number {
  let sum = 0;

  for (let i = 0; i < time.length; i++) {
    const centered = (time[i]! - 128) / 128;

    sum += centered * centered;
  }

  return Math.sqrt(sum / time.length);
}

/**
 * Taps the live streams and reduces each frame to three scalars.
 *
 * ## Cost
 *
 * Per frame this reads a fixed {@link VOICE_WAVE_FFT_SIZE}/2 = 32 frequency bins and 32
 * time-domain samples per stream, then reduces them to three numbers. That work does **not**
 * grow with the number of curves the waveform renders — 19 curves and 190 curves cost the same
 * here. The analyser itself runs on the audio thread; `getByteFrequencyData` is a copy out of an
 * already-computed buffer, not an FFT invocation.
 *
 * ## No React state
 *
 * Levels are written into a ref and read by the waveform's own rAF loop. Putting them in state
 * would re-render the provider — and therefore the entire app — sixty times a second.
 */
export function useVoiceAudioLevels(streams: {
  local: MediaStream | null;
  remote: MediaStream | null;
}) {
  const contextRef = useRef<AudioContext | null>(null);
  const tapsRef = useRef<Tap[]>([]);
  const levelsRef = useRef<VoiceAudioLevels>({ volume: 0, treble: 0, bass: 0 });

  const { local, remote } = streams;

  useEffect(() => {
    const active = [local, remote].filter((s): s is MediaStream => s !== null);

    if (active.length === 0) return;

    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!Ctor) return;

    const context = new Ctor();

    contextRef.current = context;
    tapsRef.current = active.map((stream) => {
      const analyser = context.createAnalyser();

      analyser.fftSize = VOICE_WAVE_FFT_SIZE;
      // The analyser's own smoothing handles frame-to-frame FFT jitter; the EMA below handles
      // the perceptual envelope. Both are needed — one is spectral, one is temporal.
      analyser.smoothingTimeConstant = 0.7;

      const source = context.createMediaStreamSource(stream);

      source.connect(analyser);

      return {
        analyser,
        source,
        freq: new Uint8Array(analyser.frequencyBinCount),
        time: new Uint8Array(analyser.frequencyBinCount),
      };
    });

    return () => {
      for (const tap of tapsRef.current) {
        try {
          tap.source.disconnect();
        } catch {
          /* context already torn down */
        }
      }
      tapsRef.current = [];
      contextRef.current = null;
      // Releases the audio hardware. Leaving it open keeps the device's audio path warm and
      // shows a recording indicator long after the call ended.
      void context.close().catch(() => undefined);
    };
  }, [local, remote]);

  /**
   * Reads the current levels, smoothed. Call once per animation frame; calling it more often
   * just advances the EMA faster.
   */
  const readLevels = useCallback((): VoiceAudioLevels => {
    const taps = tapsRef.current;
    const previous = levelsRef.current;

    if (taps.length === 0) {
      // Decay toward silence rather than snapping, so disconnecting does not clip the ribbon.
      const decayed = {
        volume: previous.volume * (1 - VOICE_WAVE_LEVEL_SMOOTHING),
        treble: previous.treble * (1 - VOICE_WAVE_LEVEL_SMOOTHING),
        bass: previous.bass * (1 - VOICE_WAVE_LEVEL_SMOOTHING),
      };

      levelsRef.current = decayed;

      return decayed;
    }

    let volume = 0;
    let treble = 0;
    let bass = 0;

    // Whoever is louder drives the ribbon: the user's voice and the model's should both move it.
    for (const tap of taps) {
      tap.analyser.getByteFrequencyData(tap.freq);
      tap.analyser.getByteTimeDomainData(tap.time);

      volume = Math.max(volume, rms(tap.time));
      treble = Math.max(treble, bandEnergy(tap.freq, VOICE_WAVE_TREBLE_BINS));
      bass = Math.max(bass, bandEnergy(tap.freq, VOICE_WAVE_BASS_BINS));
    }

    const k = VOICE_WAVE_LEVEL_SMOOTHING;
    const next: VoiceAudioLevels = {
      // RMS of speech rarely exceeds ~0.3; scale so normal talking uses the full range.
      volume: previous.volume + (Math.min(1, volume * 3) - previous.volume) * k,
      treble: previous.treble + (treble - previous.treble) * k,
      bass: previous.bass + (bass - previous.bass) * k,
    };

    levelsRef.current = next;

    return next;
  }, []);

  return readLevels;
}

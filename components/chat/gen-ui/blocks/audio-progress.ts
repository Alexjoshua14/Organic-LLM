/**
 * Smooth audio seek progress between sparse media clock updates.
 * Browsers (notably Firefox) quantise `HTMLMediaElement.currentTime`; projecting
 * forward with wall-clock + playbackRate keeps the thumb gliding between syncs.
 */

export type AudioProgressSample = {
  mediaTime: number;
  wallTimeMs: number;
  playbackRate: number;
  playing: boolean;
};

export function clampAudioTime(seconds: number, duration: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return seconds;

  return Math.min(seconds, duration);
}

export function formatAudioSnippetTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Project media time from the last known sample to `nowMs`.
 * Pause freezes at the sample; a fresh sample (resync) always wins as the base.
 */
export function interpolateAudioProgress(
  sample: AudioProgressSample,
  nowMs: number,
  duration: number
): number {
  const base = clampAudioTime(sample.mediaTime, duration);

  if (!sample.playing) return base;

  const rate =
    Number.isFinite(sample.playbackRate) && sample.playbackRate > 0 ? sample.playbackRate : 1;
  const elapsedSec = Math.max(0, nowMs - sample.wallTimeMs) / 1000;
  const projected = base + elapsedSec * rate;

  return clampAudioTime(projected, duration);
}

/**
 * Pure beat timeline for showcase demos that are not a chat transcript (context controls,
 * usage, voice, rabbit holes). A session is chapters of named beats with fixed durations;
 * the stage derives what to render from which beat is active and how far through it is.
 *
 * Chat-shaped demos should use `replay-timeline.ts`, which streams UIMessages instead.
 */

import { REPLAY_LOOP_HOLD_MS } from "./replay-timing";

export type ScriptBeat = {
  /** Unique across the whole session — stages branch on it. */
  id: string;
  durationMs: number;
};

export type ScriptChapter = {
  id: string;
  title: string;
  caption: string;
  beats: readonly ScriptBeat[];
};

export type ScriptSession = {
  id: string;
  chapters: readonly ScriptChapter[];
  /** Hold on the final state before a looping clock wraps. Defaults to `REPLAY_LOOP_HOLD_MS`. */
  endHoldMs?: number;
};

export type CompiledScriptBeat = {
  id: string;
  /** Position in the flat beat list. */
  index: number;
  chapterIndex: number;
  startMs: number;
  endMs: number;
};

export type CompiledScriptChapter = {
  id: string;
  title: string;
  caption: string;
  index: number;
  startMs: number;
  endMs: number;
  beats: CompiledScriptBeat[];
};

export type CompiledScript = {
  sessionId: string;
  chapters: CompiledScriptChapter[];
  beats: CompiledScriptBeat[];
  /** When the last beat ends; the end hold follows. */
  contentEndMs: number;
  durationMs: number;
};

export type ScriptFrame = {
  /** Absolute time of this frame (clamped). */
  tMs: number;
  durationMs: number;
  complete: boolean;
  chapterIndex: number;
  /** Flat index of the active beat. */
  beatIndex: number;
  beatId: string;
  /** 0 → 1 through the active beat; 1 during the end hold. */
  beatProgress: number;
};

/**
 * Compile a hand-authored script into absolute times. Throws on an empty session,
 * an empty chapter, a duplicate beat id, or a non-positive duration — all authoring errors.
 */
export function compileScript(session: ScriptSession): CompiledScript {
  if (session.chapters.length === 0) {
    throw new Error(`Script "${session.id}" has no chapters`);
  }

  const seen = new Set<string>();
  const chapters: CompiledScriptChapter[] = [];
  const beats: CompiledScriptBeat[] = [];
  let t = 0;

  session.chapters.forEach((chapter, chapterIndex) => {
    if (chapter.beats.length === 0) {
      throw new Error(`Script "${session.id}" chapter "${chapter.id}" has no beats`);
    }

    const startMs = t;
    const compiledBeats: CompiledScriptBeat[] = [];

    for (const beat of chapter.beats) {
      if (seen.has(beat.id)) {
        throw new Error(`Script "${session.id}" repeats beat id "${beat.id}"`);
      }
      if (!(beat.durationMs > 0)) {
        throw new Error(`Script "${session.id}" beat "${beat.id}" needs a positive duration`);
      }
      seen.add(beat.id);

      const compiled: CompiledScriptBeat = {
        id: beat.id,
        index: beats.length,
        chapterIndex,
        startMs: t,
        endMs: t + beat.durationMs,
      };

      beats.push(compiled);
      compiledBeats.push(compiled);
      t = compiled.endMs;
    }

    chapters.push({
      id: chapter.id,
      title: chapter.title,
      caption: chapter.caption,
      index: chapterIndex,
      startMs,
      endMs: t,
      beats: compiledBeats,
    });
  });

  return {
    sessionId: session.id,
    chapters,
    beats,
    contentEndMs: t,
    durationMs: t + Math.max(0, session.endHoldMs ?? REPLAY_LOOP_HOLD_MS),
  };
}

/** Derive which beat is active at `tMs` (clamped to [0, duration]). */
export function deriveScriptFrame(script: CompiledScript, tMsRaw: number): ScriptFrame {
  const tMs = Math.max(0, Math.min(tMsRaw, script.durationMs));
  const last = script.beats[script.beats.length - 1]!;
  let beat = last;

  for (const candidate of script.beats) {
    if (tMs < candidate.endMs) {
      beat = candidate;
      break;
    }
  }

  const span = beat.endMs - beat.startMs;
  const beatProgress =
    tMs >= beat.endMs ? 1 : Math.max(0, Math.min(1, (tMs - beat.startMs) / span));

  return {
    tMs,
    durationMs: script.durationMs,
    complete: tMs >= script.durationMs,
    chapterIndex: beat.chapterIndex,
    beatIndex: beat.index,
    beatId: beat.id,
    beatProgress,
  };
}

function beatById(script: CompiledScript, beatId: string): CompiledScriptBeat {
  const beat = script.beats.find((b) => b.id === beatId);

  if (!beat) throw new Error(`Script "${script.sessionId}" has no beat "${beatId}"`);

  return beat;
}

/** True once playback has started the named beat — stages accumulate state with this. */
export function hasReachedBeat(script: CompiledScript, tMs: number, beatId: string): boolean {
  return tMs >= beatById(script, beatId).startMs;
}

/** 0 before the named beat, 0 → 1 while it plays, 1 after. */
export function beatProgressAt(script: CompiledScript, tMs: number, beatId: string): number {
  const beat = beatById(script, beatId);

  if (tMs <= beat.startMs) return 0;
  if (tMs >= beat.endMs) return 1;

  return (tMs - beat.startMs) / (beat.endMs - beat.startMs);
}

/** Absolute start of each chapter, for seek-and-play. */
export function scriptChapterStarts(script: CompiledScript): number[] {
  return script.chapters.map((c) => c.startMs);
}

/**
 * The last instant of each chapter — its finished state. Reduced-motion stepping seeks here
 * so every chapter shows a settled frame rather than its empty opening. This is 1ms before
 * the chapter ends, so its final beat reads ~0.999 progress: tween on progress, and do not
 * gate settled content on `beatProgress === 1`.
 */
export function scriptChapterSettledTimes(script: CompiledScript): number[] {
  return script.chapters.map((c) => Math.max(c.startMs, c.endMs - 1));
}

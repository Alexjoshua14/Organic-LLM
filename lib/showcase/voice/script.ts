/**
 * Scripted voice demo: a hands-free question in the field, derived from the replay clock.
 * No microphone, no live session — the stage only renders this frame.
 */

import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";
import {
  beatProgressAt,
  compileScript,
  deriveScriptFrame,
  hasReachedBeat,
  type ScriptSession,
} from "@/lib/showcase/scripted-timeline";

const { settings, gear } = SHOWCASE_STORY;

/** Spoken question while the bar is listening. */
export const VOICE_USER_LINE = "What shutter speed should I start with?";

/** Starting exposure, built from the shared story so every demo agrees. */
export const VOICE_ASSISTANT_LINE = `Start at ${settings.shutter} — ${settings.shutterReason}. Set the ${gear.focalLengthMm}mm lens to ${settings.aperture} and ${settings.iso}, with ${settings.focus}.`;

/** Question types in, then a short hold so the line can be read while still listening. */
const LISTEN_REVEAL_MS = 3400;
const LISTEN_HOLD_MS = 700;
/** Inside the Speaking chapter — not its own pill. */
const THINK_MS = 800;
const SPEAK_MS = 5100;

export const voiceDemoSession = {
  id: "voice",
  endHoldMs: 1200,
  chapters: [
    {
      id: "listening",
      title: "Listening",
      caption: "In the field at night, hands on the tripod, you ask for a starting shutter speed.",
      beats: [
        { id: "user-ask", durationMs: LISTEN_REVEAL_MS },
        { id: "user-hold", durationMs: LISTEN_HOLD_MS },
      ],
    },
    {
      id: "speaking",
      title: "Speaking",
      caption: "The assistant answers with a starting exposure for the 24mm lens.",
      beats: [
        { id: "think", durationMs: THINK_MS },
        { id: "answer", durationMs: SPEAK_MS },
      ],
    },
  ],
} as const satisfies ScriptSession;

export const voiceDemoScript = compileScript(voiceDemoSession);

export type VoiceDemoPhase = "idle" | "listening" | "thinking" | "speaking";

export type VoiceDemoLine = {
  role: "user" | "assistant";
  text: string;
  complete: boolean;
};

export type VoiceDemoChapter = {
  id: string;
  title: string;
  caption: string;
  index: number;
};

export type VoiceDemoFrame = {
  phase: VoiceDemoPhase;
  lines: VoiceDemoLine[];
  chapter: VoiceDemoChapter;
};

/** Which waveform stream the bar should receive. Null keeps the phase label without audio. */
export type VoiceStreamSlot = "local" | "remote" | null;

export type VoiceDemoModel = {
  audioEnabled: boolean;
};

export function initialVoiceDemoModel(): VoiceDemoModel {
  return { audioEnabled: false };
}

/**
 * Listening drives the local stream, speaking the remote stream, and only after opt-in.
 * Thinking, idle, and audio-off pass nothing — the bar still shows its phase.
 */
export function selectVoiceStream(phase: VoiceDemoPhase, audioEnabled: boolean): VoiceStreamSlot {
  if (!audioEnabled) return null;
  if (phase === "listening") return "local";
  if (phase === "speaking") return "remote";

  return null;
}

function revealed(full: string, progress: number): string {
  if (!(progress > 0)) return "";
  if (progress >= 1) return full;

  const words = full.split(" ");
  const count = Math.min(words.length, Math.ceil(words.length * progress));

  if (count >= words.length) return full;

  return words.slice(0, count).join(" ");
}

function phaseAt(tMs: number): VoiceDemoPhase {
  if (hasReachedBeat(voiceDemoScript, tMs, "answer")) return "speaking";
  if (hasReachedBeat(voiceDemoScript, tMs, "think")) return "thinking";

  return "listening";
}

function line(role: VoiceDemoLine["role"], full: string, progress: number): VoiceDemoLine | null {
  const text = revealed(full, progress);

  if (text.length === 0) return null;

  return { role, text, complete: text === full };
}

/** Frame at `tMs`: phase, accumulated transcript, and the active chapter. */
export function deriveVoiceDemo(tMs: number): VoiceDemoFrame {
  const frame = deriveScriptFrame(voiceDemoScript, tMs);
  const chapter = voiceDemoScript.chapters[frame.chapterIndex]!;
  const user = line(
    "user",
    VOICE_USER_LINE,
    beatProgressAt(voiceDemoScript, frame.tMs, "user-ask")
  );
  const assistant = line(
    "assistant",
    VOICE_ASSISTANT_LINE,
    beatProgressAt(voiceDemoScript, frame.tMs, "answer")
  );

  return {
    phase: phaseAt(frame.tMs),
    lines: [user, assistant].filter((entry): entry is VoiceDemoLine => entry !== null),
    chapter: {
      id: chapter.id,
      title: chapter.title,
      caption: chapter.caption,
      index: chapter.index,
    },
  };
}

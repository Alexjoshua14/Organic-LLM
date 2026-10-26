import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";
import { scriptChapterSettledTimes } from "@/lib/showcase/scripted-timeline";
import {
  deriveVoiceDemo,
  initialVoiceDemoModel,
  selectVoiceStream,
  VOICE_ASSISTANT_LINE,
  VOICE_USER_LINE,
  voiceDemoScript,
} from "@/lib/showcase/voice/script";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const IMPLEMENTATION_FILES = [
  "lib/showcase/voice/script.ts",
  "components/showcase/voice/synthetic-voice-stream.ts",
  "components/showcase/voice/VoiceShowcaseStage.tsx",
  "app/showcase/voice/page.tsx",
];

describe("voice demo script", () => {
  test("content lasts about ten seconds, then a short hold", () => {
    expect(voiceDemoScript.contentEndMs).toBeGreaterThanOrEqual(8000);
    expect(voiceDemoScript.contentEndMs).toBeLessThanOrEqual(12000);
    expect(voiceDemoScript.durationMs - voiceDemoScript.contentEndMs).toBe(1200);
    expect(voiceDemoScript.chapters.map((chapter) => chapter.title)).toEqual([
      "Listening",
      "Speaking",
    ]);
  });

  test("the assistant line uses the shared exposure, and the question asks for shutter speed", () => {
    expect(VOICE_USER_LINE.toLowerCase()).toContain("shutter");
    expect(VOICE_ASSISTANT_LINE).toContain(SHOWCASE_STORY.settings.shutter);
    expect(VOICE_ASSISTANT_LINE).toContain(SHOWCASE_STORY.settings.shutterReason);
    expect(VOICE_ASSISTANT_LINE).toContain(`${SHOWCASE_STORY.gear.focalLengthMm}mm`);
    expect(VOICE_ASSISTANT_LINE).toContain(SHOWCASE_STORY.settings.aperture);
    expect(VOICE_ASSISTANT_LINE).toContain(SHOWCASE_STORY.settings.iso);
    expect(VOICE_ASSISTANT_LINE).toContain(SHOWCASE_STORY.settings.focus);
  });

  test("during listening, the phase is listening and the user line is present", () => {
    const listening = voiceDemoScript.chapters[0]!;
    const mid = Math.round((listening.startMs + listening.endMs) / 2);
    const settled = scriptChapterSettledTimes(voiceDemoScript)[0]!;

    for (const t of [1, mid, settled]) {
      const frame = deriveVoiceDemo(t);
      const user = frame.lines.find((line) => line.role === "user");
      const assistant = frame.lines.find((line) => line.role === "assistant");

      expect(frame.phase).toBe("listening");
      expect(frame.chapter.id).toBe("listening");
      expect(user?.text.length ?? 0).toBeGreaterThan(0);
      expect(assistant?.complete ?? false).toBe(false);
      expect(assistant?.text ?? "").not.toBe(VOICE_ASSISTANT_LINE);
    }

    const partial = deriveVoiceDemo(mid).lines.find((line) => line.role === "user");

    expect(partial?.complete).toBe(false);
    expect(partial?.text.length).toBeLessThan(VOICE_USER_LINE.length);

    const settledUser = deriveVoiceDemo(settled).lines.find((line) => line.role === "user");

    expect(settledUser?.text).toBe(VOICE_USER_LINE);
    expect(settledUser?.complete).toBe(true);
  });

  test("a short thinking beat stays inside the speaking chapter", () => {
    const think = voiceDemoScript.beats.find((beat) => beat.id === "think")!;
    const frame = deriveVoiceDemo(Math.round((think.startMs + think.endMs) / 2));
    const assistant = frame.lines.find((line) => line.role === "assistant");

    expect(frame.phase).toBe("thinking");
    expect(frame.chapter.id).toBe("speaking");
    expect(frame.lines.find((line) => line.role === "user")?.text).toBe(VOICE_USER_LINE);
    expect(assistant?.complete ?? false).toBe(false);
  });

  test("by the end, the bar is speaking and both lines are present", () => {
    for (const t of [voiceDemoScript.contentEndMs, voiceDemoScript.durationMs]) {
      const frame = deriveVoiceDemo(t);

      expect(frame.phase).toBe("speaking");
      expect(frame.lines.map((line) => [line.role, line.text, line.complete])).toEqual([
        ["user", VOICE_USER_LINE, true],
        ["assistant", VOICE_ASSISTANT_LINE, true],
      ]);
    }

    const settledSpeaking = deriveVoiceDemo(scriptChapterSettledTimes(voiceDemoScript)[1]!);

    expect(settledSpeaking.phase).toBe("speaking");
    expect(settledSpeaking.lines.find((line) => line.role === "assistant")?.text).toBe(
      VOICE_ASSISTANT_LINE
    );
  });
});

describe("voice demo audio model", () => {
  test("audio is off until opted in, and streams follow the phase", () => {
    const initial = initialVoiceDemoModel();

    expect(initial.audioEnabled).toBe(false);
    expect(selectVoiceStream("listening", initial.audioEnabled)).toBeNull();
    expect(selectVoiceStream("speaking", false)).toBeNull();
    expect(selectVoiceStream("listening", true)).toBe("local");
    expect(selectVoiceStream("speaking", true)).toBe("remote");
    expect(selectVoiceStream("thinking", true)).toBeNull();
    expect(selectVoiceStream("idle", true)).toBeNull();
  });

  test("the demo sources do not open a microphone or a live speak session", () => {
    const forbidden = ["getUserMedia", "mediaDevices", "/api/ai/speak"];

    for (const file of IMPLEMENTATION_FILES) {
      const source = readFileSync(join(root, file), "utf8");

      for (const token of forbidden) {
        expect([file, token, source.includes(token)]).toEqual([file, token, false]);
      }
    }
  });
});

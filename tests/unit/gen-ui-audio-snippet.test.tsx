import { describe, expect, test, afterEach, beforeEach } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import {
  clearAudioSnippetMemoryCache,
  AudioSnippet,
} from "@/components/chat/gen-ui/blocks/AudioSnippet";
import {
  clampAudioTime,
  interpolateAudioProgress,
  type AudioProgressSample,
} from "@/components/chat/gen-ui/blocks/audio-progress";
import { buildAudioSnippetMetaItems } from "@/components/chat/gen-ui/blocks/audio-snippet-meta";
import { FIXTURE_AUDIO_SNIPPET } from "@/lib/schemas/gen-ui/fixtures";
import type { AudioSnippetBlock } from "@/lib/schemas/gen-ui/audio-snippet";
import { createFakeMP3, uint8ArrayToRecord } from "../helpers/mock-tts";
import { render } from "../helpers/render";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  clearAudioSnippetMemoryCache();
  if (typeof indexedDB !== "undefined") {
    indexedDB.deleteDatabase("organic-llm-tts-cache");
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
});

describe("interpolateAudioProgress", () => {
  const base: AudioProgressSample = {
    mediaTime: 10,
    wallTimeMs: 1_000,
    playbackRate: 1,
    playing: true,
  };

  test("playing advances between updates using wall clock", () => {
    expect(interpolateAudioProgress(base, 1_500, 60)).toBeCloseTo(10.5, 5);
  });

  test("pause freezes at the sample media time", () => {
    const paused = { ...base, playing: false };
    expect(interpolateAudioProgress(paused, 5_000, 60)).toBe(10);
  });

  test("resync sample wins as the new base", () => {
    const resynced: AudioProgressSample = {
      mediaTime: 12.25,
      wallTimeMs: 2_000,
      playbackRate: 1,
      playing: true,
    };
    expect(interpolateAudioProgress(resynced, 2_250, 60)).toBeCloseTo(12.5, 5);
  });

  test("clamps to duration", () => {
    expect(interpolateAudioProgress(base, 100_000, 12)).toBe(12);
    expect(clampAudioTime(-3, 12)).toBe(0);
  });

  test("respects playbackRate", () => {
    const fast = { ...base, playbackRate: 2 };
    expect(interpolateAudioProgress(fast, 1_500, 60)).toBeCloseTo(11, 5);
  });
});

describe("buildAudioSnippetMetaItems", () => {
  test("all three present: duration, tone, cost", () => {
    expect(
      buildAudioSnippetMetaItems({
        duration: "~1:30",
        tone: "concise",
        costLabel: "~$0.01",
      })
    ).toEqual([
      { key: "duration", label: "~1:30", tabularNums: true },
      { key: "tone", label: "concise" },
      { key: "cost", label: "Est. cost ~$0.01" },
    ]);
  });

  test("omits tone when absent", () => {
    expect(
      buildAudioSnippetMetaItems({
        duration: "~1:30",
        tone: null,
        costLabel: "~$0.01",
      }).map((item) => item.key)
    ).toEqual(["duration", "cost"]);
  });

  test("omits duration when absent", () => {
    expect(
      buildAudioSnippetMetaItems({
        duration: "  ",
        tone: "calm",
        costLabel: "~$0.02",
      }).map((item) => item.key)
    ).toEqual(["tone", "cost"]);
  });
});

describe("AudioSnippet seek + script a11y", () => {
  function stubTtsFetch() {
    const fakeMp3Record = uint8ArrayToRecord(createFakeMP3(5));

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            uint8Array: fakeMp3Record,
            mediaType: "audio/mpeg",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )) as typeof fetch;
  }

  test("seek commit updates the time label and audio element", async () => {
    stubTtsFetch();
    const block = FIXTURE_AUDIO_SNIPPET as AudioSnippetBlock;
    const { getByRole, getByTestId, getByLabelText } = render(<AudioSnippet block={block} />);

    fireEvent.click(getByRole("button", { name: /play audio/i }));

    await waitFor(() => {
      expect(getByTestId("audio-snippet-player")).toBeTruthy();
    });

    const scrubber = getByLabelText(/seek audio/i) as HTMLInputElement;
    fireEvent.change(scrubber, { target: { value: "2" } });
    expect(getByTestId("audio-snippet-time").textContent).toContain("0:02");
  });

  test("Script toggle exposes aria-expanded / aria-controls and reveals transcript", () => {
    const block = FIXTURE_AUDIO_SNIPPET as AudioSnippetBlock;
    const { getByRole, queryByText, getByText } = render(<AudioSnippet block={block} />);

    const scriptToggle = getByRole("button", { name: /^script$/i });
    expect(scriptToggle.getAttribute("aria-expanded")).toBe("false");
    const panelId = scriptToggle.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(queryByText(block.script)).toBeNull();

    fireEvent.click(scriptToggle);
    expect(scriptToggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(panelId!)).toBeTruthy();
    expect(getByText(block.script)).toBeTruthy();
    expect(getByRole("button", { name: /copy script/i })).toBeTruthy();

    fireEvent.click(scriptToggle);
    expect(scriptToggle.getAttribute("aria-expanded")).toBe("false");
    expect(queryByText(block.script)).toBeNull();
  });

  test("meta row renders uniform separators without cost tooltip chrome", () => {
    const block = FIXTURE_AUDIO_SNIPPET as AudioSnippetBlock;
    const { getByText, queryByText, container } = render(<AudioSnippet block={block} />);

    expect(getByText("~1:30")).toBeTruthy();
    expect(getByText("concise")).toBeTruthy();
    expect(getByText(/Est\. cost/)).toBeTruthy();
    expect(queryByText(/Based on script length/i)).toBeNull();

    const cost = getByText(/Est\. cost/);
    expect(cost.className).not.toContain("underline");
    expect(cost.className).not.toContain("cursor-help");

    const separators = container.querySelectorAll('[aria-hidden="true"]');
    // duration · tone · cost · (before Script) — three meta seps; Copy icons absent while closed
    expect(separators.length).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, test, afterEach, afterAll, beforeEach } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import * as useMobile from "@/hooks/use-mobile";

import { mockModulePreservingReal } from "../helpers/module-mock";
import { createFakeMP3, uint8ArrayToRecord } from "../helpers/mock-tts";

// Merged over the real hook and restored after this file: a bare stub dropped
// `useSubmitOnEnter` and `evaluateSubmitOnEnter` for every file loaded after it.
const restoreUseMobile = mockModulePreservingReal("@/hooks/use-mobile", useMobile, {
  useIsMobile: () => false,
});

afterAll(restoreUseMobile);

import { clearAudioSnippetMemoryCache } from "@/components/chat/gen-ui/blocks/AudioSnippet";
import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GenUISkeleton } from "@/components/chat/gen-ui/GenUISkeleton";
import { render } from "../helpers/render";
import {
  FIXTURE_ANSWER_CARD,
  FIXTURE_AUDIO_SNIPPET,
  FIXTURE_INVALID_BLOCK,
} from "@/lib/schemas/gen-ui/fixtures";
import type { AudioSnippetBlock } from "@/lib/schemas/gen-ui/audio-snippet";
import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

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

describe("GenUIRenderer", () => {
  test("renders answer card for valid tool output", () => {
    const { getByText } = render(
      <GenUIRenderer data={{ block: FIXTURE_ANSWER_CARD }} messageId="t1" />
    );
    expect(getByText(FIXTURE_ANSWER_CARD.tldr)).toBeTruthy();
    expect(getByText(/Summary/)).toBeTruthy();
  });

  test("falls back to markdown for invalid block", () => {
    const { getByText } = render(<GenUIRenderer data={FIXTURE_INVALID_BLOCK} messageId="t2" />);
    expect(getByText(/Bad version|structured block/i)).toBeTruthy();
  });

  test("renders restaurant card condensed view", () => {
    const block: RestaurantCardBlock = {
      type: "restaurant-card",
      version: 1,
      name: "State Bird Provisions",
      storeType: "fine_dining",
      heroImage: {
        url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
        alt: "State Bird Provisions exterior",
      },
      rating: {
        average: 4.6,
        reviewCount: 1520,
        sources: [{ name: "google", rating: 4.6, reviewCount: 1520 }],
      },
    };

    const { getByText } = render(<GenUIRenderer data={{ block }} messageId="t3" />);
    expect(getByText(block.name)).toBeTruthy();
    expect(getByText(/1\.5k reviews/)).toBeTruthy();
  });
});

describe("AudioSnippet ElevenLabs playback", () => {
  test("Play button is enabled and synthesizes, plays, pauses, and scrubs audio without re-fetching", async () => {
    const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fakeMp3Record = uint8ArrayToRecord(createFakeMP3(5));

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

      fetchCalls.push({ url, body });

      return new Response(
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
      );
    }) as typeof fetch;

    const block: AudioSnippetBlock = {
      ...(FIXTURE_AUDIO_SNIPPET as AudioSnippetBlock),
      script: "Take a moment and zoom out. Welcome to Aetherion.",
      voiceId: "voice-custom-123",
      meta: { tone: "reflective, calm, deliberate" },
    };

    const { getByRole, queryByText, getByTestId, getByLabelText } = render(
      <GenUIRenderer data={{ block }} messageId="audio-1" />
    );

    expect(queryByText(/Audio generation — Phase 2/i)).toBeNull();

    const playButton = getByRole("button", { name: /play audio/i }) as HTMLButtonElement;
    expect(playButton.disabled).toBe(false);

    // Click Play -> synthesizes via /api/ai/tts and transitions to playing
    fireEvent.click(playButton);

    await waitFor(() => {
      expect(getByRole("button", { name: /pause audio/i })).toBeTruthy();
    });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe("/api/ai/tts");
    expect(fetchCalls[0]?.body).toEqual({
      text: "Take a moment and zoom out. Welcome to Aetherion.",
      model: "eleven_flash_v2_5",
      skipTransform: true,
      voiceId: "voice-custom-123",
      tone: "reflective, calm, deliberate",
    });

    // Scrubber and time display appear once audio is synthesized
    expect(getByTestId("audio-snippet-player")).toBeTruthy();
    const scrubber = getByLabelText(/seek audio/i) as HTMLInputElement;
    fireEvent.change(scrubber, { target: { value: "2" } });
    expect(getByTestId("audio-snippet-time").textContent).toContain("0:02");

    // Click Pause -> pauses playback
    const pauseButton = getByRole("button", { name: /pause audio/i });
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(getByRole("button", { name: /play audio/i })).toBeTruthy();
    });

    // Click Play again -> plays from cached audio without a second fetch call
    fireEvent.click(getByRole("button", { name: /play audio/i }));

    await waitFor(() => {
      expect(getByRole("button", { name: /pause audio/i })).toBeTruthy();
    });
    expect(fetchCalls).toHaveLength(1);
  });

  test("surfaces clear error message when ELEVENLABS_API_KEY is missing or API returns error", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error:
            "ELEVENLABS_API_KEY is not configured. Add your ElevenLabs API key to synthesize audio.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      )) as typeof fetch;

    const block: AudioSnippetBlock = {
      ...(FIXTURE_AUDIO_SNIPPET as AudioSnippetBlock),
      script: "Unique script for error test.",
    };

    const { getByRole } = render(<GenUIRenderer data={{ block }} messageId="audio-err" />);

    const playButton = getByRole("button", { name: /play audio/i });
    fireEvent.click(playButton);

    await waitFor(() => {
      const alert = getByRole("alert");
      expect(alert.textContent).toContain("ELEVENLABS_API_KEY is not configured");
    });

    // Button remains enabled so the user can retry after configuring their key
    expect((getByRole("button", { name: /play audio/i }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });
});

describe("GenUISkeleton", () => {
  test("streaming partial shows skeleton with type label", () => {
    const { getByLabelText } = render(
      <GenUISkeleton
        partialInput={{ type: "plan-timeline", title: "Loading plan" }}
        type="plan-timeline"
      />
    );
    expect(getByLabelText(/Loading structured response/i)).toBeTruthy();
  });
});

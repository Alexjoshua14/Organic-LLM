import type { ResurfaceResponse } from "@/lib/resurface/schema";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor, within } from "@testing-library/react";

import { HomeResurfaceSection } from "@/components/pages/home-resurface/home-resurface-section";
import { VoiceSessionProvider } from "@/components/voice/voice-session-provider";
import { createFetchResponse } from "../helpers/mock-fetch";
import {
  createRealtimeVoiceHarness,
  speakReply,
  type RealtimeVoiceHarness,
} from "../helpers/mock-realtime-voice";
import { ensureDom } from "../helpers/render";

ensureDom();

const RESPONSE: ResurfaceResponse = {
  source: "jev",
  voiceEnabled: true,
  cards: [
    { id: "card-1", kind: "thread", title: "Lisbon trip plan", href: "/chat/t1" },
    { id: "card-2", kind: "memory", title: "Learn to fillet fish", href: null },
  ],
};

const EXPIRED = "That thought is no longer on hand. Refresh the homepage and try again.";

let harness: RealtimeVoiceHarness;
let restoreFetch: () => void;
let resurface: ResurfaceResponse | null;
let cardExpired: boolean;

beforeEach(() => {
  resurface = RESPONSE;
  cardExpired = false;
  harness = createRealtimeVoiceHarness({
    session: (_body, n) =>
      cardExpired
        ? speakReply(404, { error: EXPIRED })
        : {
            clientSecret: "secret",
            sessionId: `session-${n}`,
            model: "gpt-realtime-2.1-mini",
            threadId: "thread-1",
            resumed: false,
          },
  });

  const restoreHarness = harness.install();
  const speakFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/api/homepage/resurface")) {
      return resurface
        ? createFetchResponse({ body: resurface })
        : createFetchResponse({ status: 429, body: { error: "Rate limited" } });
    }

    return speakFetch(input, init);
  }) as typeof fetch;
  restoreFetch = restoreHarness;
});

afterEach(() => {
  restoreFetch();
});

function renderSection() {
  return render(
    <VoiceSessionProvider transportFactory={harness.transportFactory}>
      <HomeResurfaceSection />
    </VoiceSessionProvider>
  );
}

describe("HomeResurfaceSection", () => {
  test("shows each thought with a two-line title; chats link to their thread, memories do not", async () => {
    const app = renderSection();
    const ui = within(app.baseElement);

    const link = await ui.findByRole("link", { name: "Lisbon trip plan" });
    const memoryTitle = ui.getByText("Learn to fillet fish");

    expect(link.getAttribute("href")).toBe("/chat/t1");
    expect(link.className).toContain("line-clamp-2");
    expect(memoryTitle.tagName).toBe("SPAN");
    expect(memoryTitle.className).toContain("line-clamp-2");
    app.unmount();
  });

  test("the voice start is not the live bar: no live region, no lumen, no clock", async () => {
    const app = renderSection();
    const ui = within(app.baseElement);
    const start = await ui.findByRole("button", { name: "Talk about “Lisbon trip plan” by voice" });

    expect(start.closest("[data-voice-live-bar]")).toBeNull();
    expect(app.baseElement.querySelector("[role='status']")).toBeNull();
    expect(start.innerHTML).not.toContain("bg-lumen");
    app.unmount();
  });

  test("tapping it starts a call seeded with that card", async () => {
    const app = renderSection();
    const ui = within(app.baseElement);

    fireEvent.click(
      await ui.findByRole("button", { name: "Talk about “Learn to fillet fish” by voice" })
    );

    await waitFor(() => expect(harness.callsTo("session")).toHaveLength(1));
    expect(harness.callsTo("session")[0]!.body.resurfaceSeed).toEqual({ cardId: "card-2" });
    app.unmount();
  });

  test("a call that fails to start says so on the card it was started from", async () => {
    cardExpired = true;

    const app = renderSection();
    const ui = within(app.baseElement);

    fireEvent.click(
      await ui.findByRole("button", { name: "Talk about “Lisbon trip plan” by voice" })
    );

    const notice = await ui.findByText("Couldn’t start voice");

    expect(notice.getAttribute("title")).toBe(EXPIRED);
    expect(notice.getAttribute("aria-live")).toBe("polite");
    expect(notice.closest("[data-resurface-card]")?.textContent).toContain("Lisbon trip plan");
    // The other card is untouched.
    expect(ui.getByText("Memory")).toBeTruthy();

    // Trying again clears it until the new attempt settles.
    cardExpired = false;
    fireEvent.click(ui.getByRole("button", { name: "Talk about “Lisbon trip plan” by voice" }));
    await waitFor(() => expect(ui.queryByText("Couldn’t start voice")).toBeNull());
    app.unmount();
  });

  test("with Speak off there is no voice start, and with nothing to show there is no row", async () => {
    resurface = { ...RESPONSE, voiceEnabled: false };

    const app = renderSection();
    const ui = within(app.baseElement);

    await ui.findByRole("link", { name: "Lisbon trip plan" });
    expect(ui.queryByRole("button", { name: /by voice/ })).toBeNull();
    app.unmount();

    resurface = null;

    const empty = renderSection();

    await new Promise((r) => setTimeout(r, 20));
    expect(empty.baseElement.querySelector("[data-home-resurface]")).toBeNull();
    empty.unmount();
  });
});

import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";

import {
  useVoiceSession,
  VoiceSessionProvider,
  type VoiceSessionValue,
} from "@/components/voice/voice-session-provider";
import { useVoiceScreenContext } from "@/hooks/use-voice-screen-context";
import { SpeakScreenContextBodySchema } from "@/lib/schemas/speak-screen-context";
import { buildAmbientContext } from "@/lib/speak/ambient-context";
import { AMBIENT_CLEARED_BODY, AMBIENT_PREFACE } from "@/lib/speak/ambient-item";
import {
  createRealtimeVoiceHarness,
  SPEAK_TEST_THREAD_ID,
  systemItemTexts,
  type RealtimeVoiceHarness,
} from "../helpers/mock-realtime-voice";
import { ensureDom } from "../helpers/render";
import {
  RABBIT_HOLE_SESSION_ID,
  rabbitHoleAmbientDeps,
  rabbitHoleFixture,
  SPEAK_TEST_OWNER,
} from "../helpers/speak-fixtures";

ensureDom();

/**
 * The whole client path, provider down: a page registers what is on screen, the provider asks
 * `/context`, and the hook pushes the reply to the model. `/context` is answered by the real
 * route schema and the real `buildAmbientContext`, so what reaches the fake transport is what
 * production would send.
 */

let harness: RealtimeVoiceHarness;
let restoreFetch: () => void;
/** The rabbit hole as the server currently has it; tests change it mid-flight. */
let serverSession: RabbitHoleSession;
let voice: VoiceSessionValue;

beforeEach(() => {
  serverSession = rabbitHoleFixture();
  harness = createRealtimeVoiceHarness({
    context: async (body) => {
      const parsed = SpeakScreenContextBodySchema.parse(body);

      return {
        body: await buildAmbientContext(
          { ownerId: SPEAK_TEST_OWNER, surface: parsed.surface },
          rabbitHoleAmbientDeps(() => serverSession)
        ),
      };
    },
  });
  restoreFetch = harness.install();
});

afterEach(() => {
  restoreFetch();
});

/** Stands in for the rabbit-hole shell: registers the surface, exposes the session. */
function Page({ surface }: { surface: SpeakScreenSurface | null }) {
  useVoiceScreenContext(surface);
  voice = useVoiceSession();

  return null;
}

function rabbitHole(activeNodeId: string, activeNodePending = false): SpeakScreenSurface {
  return { kind: "rabbit-hole", id: RABBIT_HOLE_SESSION_ID, activeNodeId, activeNodePending };
}

function renderApp(surface: SpeakScreenSurface | null, opts: { idlePauseMs?: number } = {}) {
  const tree = (s: SpeakScreenSurface | null) => (
    <VoiceSessionProvider
      idlePauseMs={opts.idlePauseMs}
      transportFactory={harness.transportFactory}
    >
      <Page surface={s} />
    </VoiceSessionProvider>
  );
  const view = render(tree(surface));

  return {
    ...view,
    /** Navigate: the page now shows `next`. */
    show: (next: SpeakScreenSurface | null) => view.rerender(tree(next)),
  };
}

async function connect() {
  act(() => voice.connect());
  await waitFor(() => expect(voice.connected).toBe(true));
}

/** Waits for the `n`th ambient push on the live transport and returns its text. */
async function nthPush(n: number): Promise<string> {
  await waitFor(() => expect(systemItemTexts(harness.transport).length).toBeGreaterThanOrEqual(n));

  return systemItemTexts(harness.transport)[n - 1]!;
}

describe("VoiceSessionProvider screen context on a rabbit hole", () => {
  test("opening voice on a rabbit hole gives the model the open node's summary and the map", async () => {
    const app = renderApp(rabbitHole("n2"));

    // Registered, but no call yet: nothing is sent anywhere.
    expect(harness.callsTo("context")).toHaveLength(0);

    await connect();

    const text = await nthPush(1);

    expect(harness.callsTo("context")[0]!.body.surface).toEqual(rabbitHole("n2"));
    expect(text.startsWith(AMBIENT_PREFACE)).toBe(true);
    expect(text).toContain('on the node "Mains hum"');
    expect(text).toContain("50/60Hz leakage from grid infrastructure.");
    expect(text).toContain("- City hum\n  - Mains hum ← on screen\n  - Traffic rumble");
    // Silent: context never asks the model to speak.
    expect(harness.transport.sent.some((e) => e.type === "response.create")).toBe(false);
    app.unmount();
  });

  test("moving to another node pushes that node's summary with the marker moved", async () => {
    const app = renderApp(rabbitHole("n2"));

    await connect();
    await nthPush(1);

    app.show(rabbitHole("n3"));

    const text = await nthPush(2);

    expect(harness.callsTo("context")[1]!.body.surface).toEqual(rabbitHole("n3"));
    expect(text).toContain('on the node "Traffic rumble"');
    expect(text).toContain("Tyre noise carries further once the air cools.");
    expect(text).toContain("  - Traffic rumble ← on screen");
    expect(text).not.toContain("Mains hum ← on screen");
    expect(text).not.toContain("50/60Hz leakage");
    app.unmount();
  });

  test("a fresh branch is pushed again, with its summary, when its article lands", async () => {
    serverSession.generatingNodeId = "n3";
    serverSession.nodesById.n3 = {
      ...serverSession.nodesById.n3!,
      summary: null,
      articleHtml: "",
      preview: "Early guess about traffic",
    };

    const app = renderApp(rabbitHole("n3", true));

    await connect();

    const pending = await nthPush(1);

    expect(pending).toContain("still being written");
    expect(pending).toContain("Early guess about traffic");

    // Generation completes: the server has the article, and the shell stops reporting pending.
    serverSession = rabbitHoleFixture();
    app.show(rabbitHole("n3", false));

    const landed = await nthPush(2);

    expect(landed).not.toContain("still being written");
    expect(landed).toContain("Tyre noise carries further once the air cools.");
    app.unmount();
  });

  test("leaving the rabbit hole tells the model its screen context is stale", async () => {
    const app = renderApp(rabbitHole("n2"));

    await connect();
    await nthPush(1);

    app.show(null);

    expect(await nthPush(2)).toContain(AMBIENT_CLEARED_BODY);
    expect(harness.callsTo("context")[1]!.body.surface).toEqual({ kind: "none" });
    app.unmount();
  });
});

describe("VoiceSessionProvider resume", () => {
  test("Resume on the paused bar reconnects on the same thread and restores screen context", async () => {
    // Real timers here, so the window is shortened; the exact 20s is covered in speak-voice-idle.
    const app = renderApp(rabbitHole("n2"), { idlePauseMs: 150 });
    const ui = within(app.baseElement);

    await connect();
    await nthPush(1);
    await waitFor(() => expect(voice.paused).toBe(true), { timeout: 2_000 });

    expect(harness.transports[0]!.closed).toBe(true);

    fireEvent.click(await ui.findByRole("button", { name: "Resume voice session" }));

    // Asserted on the durable record rather than `connected`, which the short window may already
    // have paused again.
    await waitFor(() => expect(harness.transports).toHaveLength(2));
    await waitFor(() => expect(systemItemTexts(harness.transports[1]!)).toHaveLength(1));

    const mints = harness.callsTo("session");

    expect(mints).toHaveLength(2);
    expect(mints[1]!.body.threadId).toBe(SPEAK_TEST_THREAD_ID);

    const restored = systemItemTexts(harness.transports[1]!)[0]!;

    expect(restored).toContain('on the node "Mains hum"');
    expect(restored).toContain("50/60Hz leakage from grid infrastructure.");
    app.unmount();
  });
});

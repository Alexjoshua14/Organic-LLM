import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { useStage } from "@/components/stage/use-stage";
import {
  VoiceSessionProvider,
  useVoiceSession,
  type VoiceSessionValue,
} from "@/components/voice/voice-session-provider";
import { useVoiceScreenContext } from "@/hooks/use-voice-screen-context";
import { compileSpeakRealtimeTools, isToolAllowedForSession } from "@/lib/llm/compile-speak-tools";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";
import { emptyStageState } from "@/lib/stage/schema";
import { stageVoiceContext } from "@/lib/stage/voice";
import { createRealtimeVoiceHarness } from "../helpers/mock-realtime-voice";

const originalFetch = globalThis.fetch;
let voice: VoiceSessionValue;
let stage: ReturnType<typeof useStage>;

function Page() {
  voice = useVoiceSession();
  stage = useStage({ voiceActive: voice.connected || voice.connecting });
  useVoiceScreenContext(
    stage.state ? { kind: "stage", revision: String(stage.state.revision) } : null
  );
  return null;
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

test("Stage tools are session-scoped and use the shared designer rather than the Speak panel", () => {
  const names = compileSpeakRealtimeTools(DEFAULT_SPEAK_MODALITIES, { stage: true }).map(
    (tool) => tool.name
  );
  expect(names).toEqual(["stage_turn"]);
  expect(
    isToolAllowedForSession("stage_turn", {
      modalities: DEFAULT_SPEAK_MODALITIES,
      memoryEnabled: false,
    })
  ).toBe(false);
  expect(
    isToolAllowedForSession("stage_turn", {
      modalities: DEFAULT_SPEAK_MODALITIES,
      memoryEnabled: false,
      stage: true,
    })
  ).toBe(true);
  expect(
    isToolAllowedForSession("render_gen_ui", {
      modalities: { text: true, genUi: true, web: true },
      memoryEnabled: true,
      stage: true,
    })
  ).toBe(false);
});

test("voice start, typed turns, screen refresh and end all stay on Stage", async () => {
  let server = emptyStageState();
  const harness = createRealtimeVoiceHarness({
    session: (body) => ({
      clientSecret: "test",
      sessionId: "stage-session",
      threadId: null,
      stage: body.stage === true,
      stageSettings: body.stageSettings,
      modalities: DEFAULT_SPEAK_MODALITIES,
    }),
    context: () => ({ body: stageVoiceContext(server), label: "Stage" }),
  });
  harness.install();
  const voiceFetch = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    if (String(url) !== "/api/stage") return voiceFetch(url, init);
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      server = {
        ...server,
        revision: server.revision + 1,
        messages: [
          { id: body.requestId, role: "user", text: body.message },
          { id: crypto.randomUUID(), role: "assistant", text: "The diagram is being arranged." },
        ],
      };
      expect(body.settings).toMatchObject({ memory: false, webSearch: false });
    }
    return Response.json({ state: server });
  }) as typeof fetch;
  const app = render(
    <VoiceSessionProvider transportFactory={harness.transportFactory}>
      <Page />
    </VoiceSessionProvider>
  );
  await waitFor(() => expect(stage.loading).toBe(false));
  act(() => voice.connect({ stage: true, stageSettings: { memory: false, webSearch: false } }));
  await waitFor(() => expect(voice.connected).toBe(true));
  expect(voice.stage).toBe(true);
  expect(harness.callsTo("session")[0].body.stage).toBe(true);
  expect(harness.callsTo("session")[0].body.personaSessionId).toBeUndefined();
  await act(async () => {
    expect(await stage.send("Make a diagram", { memory: false, webSearch: false })).toBe(true);
  });
  await waitFor(() =>
    expect(harness.callsTo("context").at(-1)?.body.surface).toEqual({
      kind: "stage",
      revision: "1",
    })
  );
  expect(voice.connected).toBe(true);
  expect(stage.state?.messages.at(-1)?.text).toContain("diagram");
  act(() => voice.disconnect());
  await waitFor(() => expect(voice.connected).toBe(false));
  expect(harness.transport.closed).toBe(true);
  expect(harness.callsTo("end")).toHaveLength(1);
  app.unmount();
});

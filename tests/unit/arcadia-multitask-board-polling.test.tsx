import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";

import {
  ArcadiaMultitaskProvider,
  useArcadiaMultitask,
} from "@/app/sandbox/arcadia/_components/multitask-provider";
import { VoiceSessionProvider, useVoiceSession } from "@/components/voice/voice-session-provider";
import { createRealtimeVoiceHarness, deferred } from "../helpers/mock-realtime-voice";

const THREAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const originalFetch = globalThis.fetch;
const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
let restoreSpeakFetch: () => void;
let harness: ReturnType<typeof createRealtimeVoiceHarness>;
let boardReads: number;
let boardReply: () => Promise<Response>;
let board: ReturnType<typeof useArcadiaMultitask>;
let voice: ReturnType<typeof useVoiceSession>;
let renders: number;

const payload = {
  subagents: [
    {
      agentId: "agent-researcher",
      threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Lyra",
      role: "researcher",
      status: "done",
      statusAt: "2026-10-09T00:00:00.000Z",
      goal: "Read the sources.",
      outcome: "Read the sources.",
    },
  ],
};

function Probe() {
  board = useArcadiaMultitask();
  voice = useVoiceSession();
  renders += 1;

  return null;
}

function App() {
  return (
    <VoiceSessionProvider transportFactory={harness.transportFactory}>
      <ArcadiaMultitaskProvider threadId={THREAD_ID}>
        <Probe />
      </ArcadiaMultitaskProvider>
    </VoiceSessionProvider>
  );
}

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  boardReads = 0;
  renders = 0;
  boardReply = async () => Response.json(payload);
  harness = createRealtimeVoiceHarness();
  restoreSpeakFetch = harness.install();
  const speakFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    const url = String(input);

    if (url.endsWith("/arcadia/subagents")) {
      boardReads += 1;

      return boardReply();
    }
    if (url.endsWith("/arcadia/multitask-view")) {
      return Response.json({ enabled: false, activeStreamId: null });
    }
    if (url.endsWith("/arcadia/heartbeat")) return Response.json({ status: "quiet" });

    return speakFetch(input, init);
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  restoreSpeakFetch();
  globalThis.fetch = originalFetch;
  if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
  else Reflect.deleteProperty(document, "visibilityState");
});

describe("Arcadia board polling", () => {
  test("voice context changes do not restart the board poll", async () => {
    await act(async () => {
      render(<App />);
    });
    const reads = boardReads;

    await act(async () => {
      voice.setBarContainer(document.createElement("div"));
    });
    await act(async () => {
      voice.setScreenSurface({ kind: "none" });
    });

    expect(boardReads).toBe(reads);
  });

  test("unchanged board responses preserve the roster and do not rerender consumers", async () => {
    await act(async () => {
      render(<App />);
    });
    const agents = board.agents;
    const before = renders;

    await act(async () => {
      board.refreshBoard();
    });

    expect(boardReads).toBe(2);
    expect(board.agents).toBe(agents);
    expect(renders).toBe(before);
  });

  test("a changed response still updates progress without repeating the completion milestone", async () => {
    await act(async () => {
      render(<App />);
    });
    const before = board.agents;
    const milestones = before[0]!.milestones;
    boardReply = async () =>
      Response.json({
        subagents: [{ ...payload.subagents[0], outcome: "Finished the follow-up." }],
      });

    await act(async () => {
      board.refreshBoard();
    });

    expect(board.agents).not.toBe(before);
    expect(board.agents[0]!.progress).toBe("Finished the follow-up.");
    expect(board.agents[0]!.milestones).toBe(milestones);
  });

  test("refreshes during a pending read produce one follow-up read without overlapping", async () => {
    const pending = deferred<Response>();
    boardReply = () => pending.promise;
    await act(async () => {
      render(<App />);
    });

    act(() => {
      board.refreshBoard();
      board.refreshBoard();
      board.refreshBoard();
    });
    expect(boardReads).toBe(1);

    boardReply = async () => Response.json(payload);
    await act(async () => {
      pending.resolve(Response.json(payload));
    });
    expect(boardReads).toBe(2);
  });
});

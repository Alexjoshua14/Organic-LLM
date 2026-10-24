import { describe, expect, test } from "bun:test";

import {
  assertSingleLiveSpeakTarget,
  planSpeakHandoff,
  resolveLiveSpeakAgentId,
  resolveSpeakBarPhase,
} from "@/lib/arcadia/multitask/speak-session";
import {
  desktopChatWiderThanAgentColumn,
  MULTITASK_DASHBOARD_WIDE_MIN_PX,
  MULTITASK_DESKTOP_AGENT_COL_MAX_PX,
} from "@/lib/arcadia/multitask/layout-mode";

describe("resolveLiveSpeakAgentId", () => {
  test("returns null when unbound", () => {
    expect(resolveLiveSpeakAgentId({ speakBindingAgentId: null })).toBeNull();
    expect(resolveLiveSpeakAgentId({ speakBindingAgentId: "  " })).toBeNull();
  });

  test("only one binding owns Speak", () => {
    expect(resolveLiveSpeakAgentId({ speakBindingAgentId: "lyra" })).toBe("lyra");
  });
});

describe("planSpeakHandoff", () => {
  test("same agent does not end current", () => {
    expect(planSpeakHandoff({ liveAgentId: "lyra", nextAgentId: "lyra" })).toEqual({
      endCurrent: false,
      outgoingAgentId: null,
      incomingAgentId: "lyra",
    });
  });

  test("starting a second agent ends the first", () => {
    const plan = planSpeakHandoff({ liveAgentId: "lyra", nextAgentId: "reed" });

    expect(plan.endCurrent).toBe(true);
    expect(plan.outgoingAgentId).toBe("lyra");
    expect(plan.incomingAgentId).toBe("reed");
  });

  test("first speak has no outgoing", () => {
    expect(planSpeakHandoff({ liveAgentId: null, nextAgentId: "mira" }).endCurrent).toBe(false);
  });
});

describe("resolveSpeakBarPhase + single live target", () => {
  test("idle → connecting → live on one agent", () => {
    expect(
      resolveSpeakBarPhase({
        agentId: "lyra",
        liveAgentId: null,
        closingAgentId: null,
        voiceConnecting: false,
        voiceConnected: false,
      })
    ).toBe("idle");

    expect(
      resolveSpeakBarPhase({
        agentId: "lyra",
        liveAgentId: "lyra",
        closingAgentId: null,
        voiceConnecting: true,
        voiceConnected: false,
      })
    ).toBe("connecting");

    expect(
      resolveSpeakBarPhase({
        agentId: "lyra",
        liveAgentId: "lyra",
        closingAgentId: null,
        voiceConnecting: false,
        voiceConnected: true,
      })
    ).toBe("live");
  });

  test("handoff: outgoing closing while incoming connecting — only one live", () => {
    const phases = [
      {
        agentId: "lyra",
        phase: resolveSpeakBarPhase({
          agentId: "lyra",
          liveAgentId: "reed",
          closingAgentId: "lyra",
          voiceConnecting: true,
          voiceConnected: false,
        }),
      },
      {
        agentId: "reed",
        phase: resolveSpeakBarPhase({
          agentId: "reed",
          liveAgentId: "reed",
          closingAgentId: "lyra",
          voiceConnecting: true,
          voiceConnected: false,
        }),
      },
      {
        agentId: "mira",
        phase: resolveSpeakBarPhase({
          agentId: "mira",
          liveAgentId: "reed",
          closingAgentId: "lyra",
          voiceConnecting: true,
          voiceConnected: false,
        }),
      },
    ];

    expect(phases[0]!.phase).toBe("closing");
    expect(phases[1]!.phase).toBe("connecting");
    expect(phases[2]!.phase).toBe("idle");
    expect(assertSingleLiveSpeakTarget(phases)).toBe("reed");
  });

  test("assertSingleLiveSpeakTarget throws if two connecting/live", () => {
    expect(() =>
      assertSingleLiveSpeakTarget([
        { agentId: "a", phase: "live" },
        { agentId: "b", phase: "connecting" },
      ])
    ).toThrow(/at most one live Speak target/);
  });
});

describe("desktopChatWiderThanAgentColumn", () => {
  test("at wide desktop min, chat is wider than the capped agent column", () => {
    expect(desktopChatWiderThanAgentColumn(MULTITASK_DASHBOARD_WIDE_MIN_PX)).toBe(true);
    expect(desktopChatWiderThanAgentColumn(1440)).toBe(true);
  });

  test("agent column max is below half of a typical laptop content width", () => {
    expect(MULTITASK_DESKTOP_AGENT_COL_MAX_PX).toBeLessThan(MULTITASK_DASHBOARD_WIDE_MIN_PX / 2);
  });
});

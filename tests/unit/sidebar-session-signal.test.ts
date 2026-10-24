import { describe, expect, test } from "bun:test";

import { getSessionExperience, SESSION_EXPERIENCES } from "@/lib/sidebar/session-experience";
import {
  deriveSessionSignal,
  describeSessionSignal,
  hasWorkingActivity,
  isRabbitHoleStep,
  isThreadHrefActive,
  rabbitHoleStepIndex,
  resolveActiveThreadId,
  sessionSignalStatusText,
  summarizeSessionSignals,
  type SidebarThreadActivity,
} from "@/lib/sidebar/session-signal";

const unseen: SidebarThreadActivity = { id: "t1", unseen: true, working: null };
const working: SidebarThreadActivity = { id: "t1", unseen: true, working: { step: "article" } };

function signalFor(overrides: Partial<Parameters<typeof deriveSessionSignal>[0]> = {}) {
  return deriveSessionSignal({
    threadId: "t1",
    experience: "chat",
    activity: undefined,
    voice: null,
    isActive: false,
    ...overrides,
  });
}

describe("getSessionExperience", () => {
  test("maps every sidebar feature to its experience", () => {
    expect(getSessionExperience(undefined)).toBe("chat");
    expect(getSessionExperience("")).toBe("chat");
    expect(getSessionExperience("main")).toBe("chat");
    expect(getSessionExperience("arcadia")).toBe("arcadia");
    expect(getSessionExperience("speak")).toBe("speak");
    expect(getSessionExperience("rabbit_hole")).toBe("rabbitHole");
    expect(getSessionExperience("topic_explore")).toBe("noesis");
    expect(getSessionExperience("strata_page")).toBe("strata");
    expect(getSessionExperience("strata_hub")).toBe("strata");
    expect(getSessionExperience("strata_agent")).toBe("strata");
    expect(getSessionExperience("remy_planner")).toBe("remy");
    expect(getSessionExperience("introspection")).toBe("introspection");
    expect(getSessionExperience("spark")).toBe("other");
  });

  test("uses four motion idioms plus a fallback, not one per experience", () => {
    const idioms = new Set(Object.values(SESSION_EXPERIENCES).map((spec) => spec.motion));

    expect([...idioms].sort()).toEqual(["breathe", "cascade", "grow", "level", "sweep"]);
  });
});

describe("deriveSessionSignal", () => {
  test("idle when nothing is happening", () => {
    expect(signalFor()).toEqual({ kind: "idle" });
  });

  test("new when content landed and the thread is not on screen", () => {
    expect(signalFor({ activity: unseen })).toEqual({ kind: "new" });
  });

  test("never new for the thread the user is looking at", () => {
    expect(signalFor({ activity: unseen, isActive: true })).toEqual({ kind: "idle" });
  });

  test("never new for Speak, which is realtime", () => {
    expect(signalFor({ experience: "speak", activity: unseen })).toEqual({ kind: "idle" });
  });

  test("working outranks new, and only rabbit holes carry a step", () => {
    expect(signalFor({ experience: "rabbitHole", activity: working })).toEqual({
      kind: "working",
      step: "article",
    });
    expect(signalFor({ activity: working })).toEqual({ kind: "working", step: null });
  });

  test("a live or paused call outranks everything, but only on its own thread", () => {
    const voice = { threadId: "t1", live: true, paused: false };

    expect(signalFor({ experience: "speak", activity: working, voice })).toEqual({ kind: "live" });
    expect(
      signalFor({ experience: "speak", voice: { threadId: "t1", live: false, paused: true } })
    ).toEqual({ kind: "paused" });
    expect(signalFor({ voice: { ...voice, threadId: "other" } })).toEqual({ kind: "idle" });
  });
});

describe("signal text", () => {
  test("status line says what is happening", () => {
    expect(sessionSignalStatusText({ kind: "working", step: "sources" })).toBe("Finding sources");
    expect(sessionSignalStatusText({ kind: "working", step: "article" })).toBe("Writing article");
    expect(sessionSignalStatusText({ kind: "working", step: "branch_suggestions" })).toBe(
      "Suggesting branches"
    );
    expect(sessionSignalStatusText({ kind: "working", step: null })).toBe("Responding");
    expect(sessionSignalStatusText({ kind: "live" })).toBe("Live");
    expect(sessionSignalStatusText({ kind: "paused" })).toBe("Paused");
  });

  test("new and idle rows have no status line", () => {
    expect(sessionSignalStatusText({ kind: "new" })).toBeNull();
    expect(sessionSignalStatusText({ kind: "idle" })).toBeNull();
  });

  test("description names the experience, then the state", () => {
    expect(describeSessionSignal("Rabbit hole", { kind: "working", step: "article" })).toBe(
      "Rabbit hole, writing article"
    );
    expect(describeSessionSignal("Chat", { kind: "new" })).toBe("Chat, new activity");
    expect(describeSessionSignal("Voice", { kind: "idle" })).toBe("Voice");
  });
});

describe("helpers", () => {
  test("rabbit-hole steps", () => {
    expect(isRabbitHoleStep("article")).toBe(true);
    expect(isRabbitHoleStep("nope")).toBe(false);
    expect(isRabbitHoleStep(null)).toBe(false);
    expect(rabbitHoleStepIndex("sources")).toBe(0);
    expect(rabbitHoleStepIndex("branch_suggestions")).toBe(2);
    expect(rabbitHoleStepIndex(null)).toBe(-1);
  });

  test("hasWorkingActivity drives polling", () => {
    expect(hasWorkingActivity(undefined)).toBe(false);
    expect(hasWorkingActivity([unseen])).toBe(false);
    expect(hasWorkingActivity([unseen, working])).toBe(true);
  });

  test("summary counts new and working, not live", () => {
    expect(
      summarizeSessionSignals([
        { kind: "new" },
        { kind: "new" },
        { kind: "working", step: null },
        { kind: "live" },
        { kind: "idle" },
      ])
    ).toEqual({ unseen: 2, working: 1 });
  });
});

describe("active thread resolution", () => {
  const hole = { id: "hole", href: "/rabbitholes?sessionId=abc" };
  const speakA = { id: "speak-a", href: "/speak" };
  const speakB = { id: "speak-b", href: "/speak" };

  test("query-string hrefs match when their params are present", () => {
    expect(isThreadHrefActive(hole.href, "/rabbitholes", "sessionId=abc&node=n1")).toBe(true);
    expect(isThreadHrefActive(hole.href, "/rabbitholes", "sessionId=xyz")).toBe(false);
    expect(isThreadHrefActive(hole.href, "/rabbitholes/", new URLSearchParams("sessionId=abc"))).toBe(
      true
    );
    expect(isThreadHrefActive(undefined, "/rabbitholes", "")).toBe(false);
  });

  test("the path-slug id wins", () => {
    expect(
      resolveActiveThreadId([hole], { chatId: "chat-1", pathname: "/rabbitholes", search: "sessionId=abc" })
    ).toBe("chat-1");
  });

  test("a unique href match is active; a shared one identifies nothing", () => {
    expect(
      resolveActiveThreadId([hole, speakA], { chatId: null, pathname: "/rabbitholes", search: "sessionId=abc" })
    ).toBe("hole");
    expect(
      resolveActiveThreadId([speakA, speakB], { chatId: null, pathname: "/speak", search: "" })
    ).toBeNull();
    expect(resolveActiveThreadId([speakA], { chatId: null, pathname: "/speak", search: "" })).toBe(
      "speak-a"
    );
  });
});

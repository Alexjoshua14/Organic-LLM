import { describe, expect, test } from "bun:test";

import { resolveChatRuntimeExperience, parseChatExperience } from "@/lib/chat/chat-experience";

describe("parseChatExperience", () => {
  test("normalizes casing for known tokens", () => {
    expect(parseChatExperience("Delphi")).toBe("delphi");
    expect(parseChatExperience("ARCADIA")).toBe("arcadia");
    expect(parseChatExperience(" Strata_Page ")).toBe("strata_page");
    expect(parseChatExperience("TOPIC_EXPLORE")).toBe("topic_explore");
  });

  test("returns undefined for unknown or empty", () => {
    expect(parseChatExperience("spark")).toBeUndefined();
    expect(parseChatExperience("")).toBeUndefined();
    expect(parseChatExperience(undefined)).toBeUndefined();
  });
});

describe("Aion runtime selection", () => {
  test("keeps Aion canonical while selecting the shared Arcadia engine", () => {
    expect(parseChatExperience(" AION ")).toBe("aion");
    expect(resolveChatRuntimeExperience(parseChatExperience("aion"))).toBe("arcadia");
  });
  test("preserves other experiences", () => {
    for (const experience of [
      undefined,
      "arcadia",
      "strata_page",
      "rabbit_hole",
      "delphi",
    ] as const) {
      expect(resolveChatRuntimeExperience(experience)).toBe(experience);
    }
  });
});

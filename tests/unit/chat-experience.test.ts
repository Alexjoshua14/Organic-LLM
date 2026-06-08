import { describe, expect, test } from "bun:test";

import { parseChatExperience } from "@/lib/chat/chat-experience";

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

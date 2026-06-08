import { describe, expect, test } from "bun:test";

import { getThreadFeatureCaption } from "@/lib/chat/thread-feature-caption";

describe("getThreadFeatureCaption", () => {
  test("maps main, topic_explore, and arcadia", () => {
    expect(getThreadFeatureCaption("main")).toBe("chat");
    expect(getThreadFeatureCaption("")).toBe("chat");
    expect(getThreadFeatureCaption(undefined)).toBe("chat");
    expect(getThreadFeatureCaption("topic_explore")).toBe("noesis");
    expect(getThreadFeatureCaption("arcadia")).toBe("arcadia");
  });

  test("humanizes unknown feature strings", () => {
    expect(getThreadFeatureCaption("strata_agent")).toBe("Strata Agent");
    expect(getThreadFeatureCaption("rabbit_hole")).toBe("Rabbit Hole");
    expect(getThreadFeatureCaption("FOO_bar")).toBe("Foo Bar");
  });
});

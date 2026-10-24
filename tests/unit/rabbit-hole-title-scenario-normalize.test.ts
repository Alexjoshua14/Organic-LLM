import { describe, expect, test } from "bun:test";

import { TITLE_SCENARIO_SEED_SESSION } from "@/lib/sandbox/scenarios/fixtures/rabbit-holes";
import { normalizeRabbitHoleTitleScenarioSession } from "@/lib/sandbox/scenarios/rabbit-hole-title-normalize";

describe("normalizeRabbitHoleTitleScenarioSession", () => {
  test("sets rootTitle from generated title and preserves seed rootQuestion", () => {
    const out = normalizeRabbitHoleTitleScenarioSession(
      { title: "LLM Title" },
      TITLE_SCENARIO_SEED_SESSION,
    );

    expect(out).not.toBeNull();
    expect(out!.rootTitle).toBe("LLM Title");
    expect(out!.rootQuestion).toBe(TITLE_SCENARIO_SEED_SESSION.rootQuestion);
  });

  test("returns null when title is null", () => {
    expect(
      normalizeRabbitHoleTitleScenarioSession({ title: null }, TITLE_SCENARIO_SEED_SESSION),
    ).toBeNull();
  });
});

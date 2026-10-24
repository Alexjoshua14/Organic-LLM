import { describe, expect, test } from "bun:test";

import { ChatRequestSchema } from "@/lib/schemas/chat";
import { UserSettingsSchema, defaultUserSettings } from "@/lib/schemas/userSettings";
import { createTestUIMessage } from "../helpers/test-fixtures";
import {
  CONTEXT_EFFORT_BUDGETS,
  CONTEXT_EFFORT_LEVELS,
  DEFAULT_CONTEXT_EFFORT,
  contextEffortForRequest,
  contextEffortFromIndex,
  contextEffortToIndex,
  estimatedMemoryContextTokensForEffort,
  parseContextEffortLevel,
} from "@/lib/memory/context-effort";

describe("context effort table", () => {
  test("tiers match Instant / Quick / Heavy budgets", () => {
    expect(CONTEXT_EFFORT_LEVELS).toEqual(["instant", "quick", "heavy"]);
    expect(DEFAULT_CONTEXT_EFFORT).toBe("quick");

    expect(CONTEXT_EFFORT_BUDGETS.instant).toMatchObject({
      budgetMs: 250,
      plannerTimeoutMs: null,
      overfetch: 8,
      injectCap: 5,
      combinedTokenCap: 400,
      includeProfile: false,
      secondPassMinRemainingMs: 0,
    });
    expect(CONTEXT_EFFORT_BUDGETS.quick).toMatchObject({
      budgetMs: 1_000,
      plannerTimeoutMs: 350,
      overfetch: 28,
      injectCap: 20,
      combinedTokenCap: 2_500,
      includeProfile: true,
      profileMaxSections: 2,
      profileRich: false,
      secondPassMinRemainingMs: 0,
    });
    expect(CONTEXT_EFFORT_BUDGETS.heavy).toMatchObject({
      budgetMs: 5_000,
      plannerTimeoutMs: 1_200,
      overfetch: 40,
      injectCap: 36,
      combinedTokenCap: 6_000,
      includeProfile: true,
      profileRich: true,
      secondPassMinRemainingMs: 800,
    });
  });

  test("index helpers snap to the three stops", () => {
    expect(contextEffortToIndex("instant")).toBe(0);
    expect(contextEffortToIndex("quick")).toBe(1);
    expect(contextEffortToIndex("heavy")).toBe(2);
    expect(contextEffortFromIndex(0)).toBe("instant");
    expect(contextEffortFromIndex(1)).toBe("quick");
    expect(contextEffortFromIndex(2)).toBe("heavy");
    expect(contextEffortFromIndex(-3)).toBe("instant");
    expect(contextEffortFromIndex(9)).toBe("heavy");
  });

  test("HUD estimate uses the combined token cap when a tier is set", () => {
    expect(estimatedMemoryContextTokensForEffort(undefined)).toBe(900);
    expect(estimatedMemoryContextTokensForEffort("instant")).toBe(400);
    expect(estimatedMemoryContextTokensForEffort("quick")).toBe(2_500);
    expect(estimatedMemoryContextTokensForEffort("heavy")).toBe(6_000);
  });
});

describe("contextEffortForRequest", () => {
  test("omits the field when the beta is off", () => {
    expect(
      contextEffortForRequest({
        experience: "arcadia",
        memoryEnabled: true,
        experimentalContextEffort: false,
        contextEffortLevel: "heavy",
      })
    ).toBeUndefined();
  });

  test("omits the field outside Arcadia or when memory is off", () => {
    expect(
      contextEffortForRequest({
        experience: "main",
        memoryEnabled: true,
        experimentalContextEffort: true,
        contextEffortLevel: "quick",
      })
    ).toBeUndefined();
    expect(
      contextEffortForRequest({
        experience: "arcadia",
        memoryEnabled: false,
        experimentalContextEffort: true,
        contextEffortLevel: "quick",
      })
    ).toBeUndefined();
  });

  test("sends the chosen tier when Arcadia + memory + beta", () => {
    expect(
      contextEffortForRequest({
        experience: "arcadia",
        memoryEnabled: true,
        experimentalContextEffort: true,
        contextEffortLevel: "instant",
      })
    ).toBe("instant");
  });
});

describe("schema defaults", () => {
  test("UserSettingsSchema defaults beta off and level quick", () => {
    const parsed = UserSettingsSchema.parse({});

    expect(parsed.experimentalContextEffort).toBe(false);
    expect(parsed.contextEffortLevel).toBe("quick");
    expect(defaultUserSettings().experimentalContextEffort).toBe(false);
    expect(defaultUserSettings().contextEffortLevel).toBe("quick");
  });

  test("ChatRequestSchema omits contextEffort when the field is absent", () => {
    const parsed = ChatRequestSchema.parse({
      message: createTestUIMessage(),
      id: "11111111-1111-4111-8111-111111111111",
    });

    expect(parsed.contextEffort).toBeUndefined();
  });

  test("ChatRequestSchema accepts instant / quick / heavy", () => {
    for (const level of CONTEXT_EFFORT_LEVELS) {
      const parsed = ChatRequestSchema.parse({
        message: createTestUIMessage(),
        id: "11111111-1111-4111-8111-111111111111",
        contextEffort: level,
      });

      expect(parsed.contextEffort).toBe(level);
    }
  });

  test("parseContextEffortLevel rejects unknown strings", () => {
    expect(parseContextEffortLevel("quick")).toBe("quick");
    expect(parseContextEffortLevel("nope")).toBeUndefined();
  });
});

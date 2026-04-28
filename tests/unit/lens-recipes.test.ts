import { describe, expect, test } from "bun:test";

import {
  ALL_FIELD_NAMES,
  ALL_MODULATOR_NAMES,
  type FieldName,
  type ModulatorName,
  type StateName,
} from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/fieldLibrary";
import { RECIPES } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/recipes";

const STATE_NAMES: StateName[] = [
  "idle_ready",
  "listening",
  "ingesting",
  "searching_memory",
  "reasoning",
  "web_search",
  "writing_memory",
];

describe("RECIPES", () => {
  test("every StateName has a recipe", () => {
    for (const s of STATE_NAMES) {
      expect(RECIPES[s]).toBeDefined();
    }
  });

  test("field keys are FieldName members", () => {
    for (const s of STATE_NAMES) {
      const keys = Object.keys(RECIPES[s].fields) as FieldName[];

      for (const k of keys) {
        expect(ALL_FIELD_NAMES).toContain(k);
      }
    }
  });

  test("modulator keys are ModulatorName members", () => {
    for (const s of STATE_NAMES) {
      const keys = Object.keys(RECIPES[s].modulators) as ModulatorName[];

      for (const k of keys) {
        expect(ALL_MODULATOR_NAMES).toContain(k);
      }
    }
  });

  test("every state has non-empty fields and at least one positive weight", () => {
    for (const s of STATE_NAMES) {
      const { fields } = RECIPES[s];
      expect(Object.keys(fields).length).toBeGreaterThan(0);
      const hasPositive = Object.values(fields).some((w) => typeof w === "number" && w > 0);
      expect(hasPositive).toBe(true);
    }
  });

  test("breath and jitter weights are in [0, 1] for every state", () => {
    for (const s of STATE_NAMES) {
      const { fields } = RECIPES[s];
      const breath = fields.breath;
      const jitter = fields.jitter;
      expect(typeof breath).toBe("number");
      expect(typeof jitter).toBe("number");
      expect(breath).toBeGreaterThanOrEqual(0);
      expect(breath).toBeLessThanOrEqual(1);
      expect(jitter).toBeGreaterThanOrEqual(0);
      expect(jitter).toBeLessThanOrEqual(1);
    }
  });
});

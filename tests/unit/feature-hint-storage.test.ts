import { describe, expect, test } from "bun:test";

import {
  dismissFeatureHint,
  dismissFeatureHintInRecord,
  isFeatureHintDismissed,
  parseFeatureHintDismissRecord,
  readFeatureHintDismissRecord,
  resetFeatureHintDismissals,
} from "@/lib/onboarding/feature-hint-storage";
import {
  FEATURE_HINTS,
  FEATURE_HINTS_MASTER_SWITCH,
  FEATURE_HINT_IDS,
  isFeatureHintEnabledInCode,
} from "@/lib/onboarding/feature-hints";

describe("feature hint storage", () => {
  test("parseFeatureHintDismissRecord rejects invalid payloads", () => {
    expect(parseFeatureHintDismissRecord(null)).toEqual({});
    expect(parseFeatureHintDismissRecord("not-json")).toEqual({});
    expect(parseFeatureHintDismissRecord("[]")).toEqual({});
    expect(parseFeatureHintDismissRecord(JSON.stringify({ "noesis-sparks": 1 }))).toEqual({
      "noesis-sparks": 1,
    });
  });

  test("dismiss persists version and hides equal or older versions", () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    expect(isFeatureHintDismissed({}, "noesis-sparks", 1)).toBe(false);

    dismissFeatureHint(mockStorage, "noesis-sparks", 1);

    const record = readFeatureHintDismissRecord(mockStorage);

    expect(isFeatureHintDismissed(record, "noesis-sparks", 1)).toBe(true);
    expect(isFeatureHintDismissed(record, "noesis-sparks", 2)).toBe(false);

    resetFeatureHintDismissals(mockStorage);
    expect(readFeatureHintDismissRecord(mockStorage)).toEqual({});
  });

  test("dismissFeatureHintInRecord is immutable", () => {
    const base = { "composer-auto-model": 1 };
    const next = dismissFeatureHintInRecord(base, "noesis-sparks", 2);

    expect(base).toEqual({ "composer-auto-model": 1 });
    expect(next).toEqual({ "composer-auto-model": 1, "noesis-sparks": 2 });
  });
});

describe("feature hints registry", () => {
  test("registry ids stay in sync with FEATURE_HINT_IDS", () => {
    expect(Object.keys(FEATURE_HINTS).sort()).toEqual([...FEATURE_HINT_IDS].sort());
  });

  test("new feature hints default to enabled in code", () => {
    expect(FEATURE_HINTS_MASTER_SWITCH).toBe(true);

    for (const hint of Object.values(FEATURE_HINTS)) {
      expect(hint.enabled).toBe(true);
      expect(hint.version).toBeGreaterThan(0);
      expect(isFeatureHintEnabledInCode(hint.id)).toBe(true);
    }
  });
});

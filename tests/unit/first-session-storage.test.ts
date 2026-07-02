import { describe, expect, test } from "bun:test";

import {
  FIRST_SESSION_STEPS,
  completeFirstSessionStep,
  dismissFirstSessionChecklist,
  isFirstSessionChecklistComplete,
  parseFirstSessionState,
  readFirstSessionState,
  shouldShowFirstSessionChecklist,
} from "@/lib/onboarding/first-session-storage";

describe("first session checklist storage", () => {
  test("parseFirstSessionState rejects invalid payloads", () => {
    expect(parseFirstSessionState(null).completedSteps).toEqual({});
    expect(parseFirstSessionState("[]").completedSteps).toEqual({});
  });

  test("completing steps and dismiss lifecycle", () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    expect(shouldShowFirstSessionChecklist(readFirstSessionState(mockStorage))).toBe(true);

    completeFirstSessionStep(mockStorage, "start-chat");
    let state = readFirstSessionState(mockStorage);

    expect(state.completedSteps["start-chat"]).toBe(true);
    expect(isFirstSessionChecklistComplete(state)).toBe(false);

    for (const step of FIRST_SESSION_STEPS) {
      completeFirstSessionStep(mockStorage, step.id);
    }

    state = readFirstSessionState(mockStorage);
    expect(isFirstSessionChecklistComplete(state)).toBe(true);

    dismissFirstSessionChecklist(mockStorage);
    expect(shouldShowFirstSessionChecklist(readFirstSessionState(mockStorage))).toBe(false);
  });
});

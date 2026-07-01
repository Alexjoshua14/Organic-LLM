import { describe, expect, test } from "bun:test";

import {
  KEYBOARD_SHORTCUT_SCOPES,
  getEnabledKeyboardShortcuts,
  getKeyboardShortcutsByScope,
} from "@/lib/onboarding/keyboard-shortcuts";

describe("keyboard shortcuts registry", () => {
  test("every scope has at least one enabled shortcut", () => {
    for (const scope of KEYBOARD_SHORTCUT_SCOPES) {
      expect(getKeyboardShortcutsByScope(scope).length).toBeGreaterThan(0);
    }
  });

  test("enabled shortcuts have unique ids", () => {
    const ids = getEnabledKeyboardShortcuts().map((shortcut) => shortcut.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("navigation scope includes sidebar toggle", () => {
    const navigation = getKeyboardShortcutsByScope("navigation");

    expect(navigation.some((shortcut) => shortcut.id === "sidebar-toggle")).toBe(true);
  });
});

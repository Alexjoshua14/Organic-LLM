import { describe, expect, test } from "bun:test";

import {
  KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUT_SCOPES,
  describeShortcut,
  formatShortcutKey,
  isApplePlatform,
  keyboardShortcutsByScope,
  visibleKeyboardShortcuts,
} from "@/lib/onboarding/keyboard-shortcuts";

const everyone = { isAdmin: false, apple: false };

describe("keyboard shortcuts catalog", () => {
  test("ids are unique and every entry names its handler", () => {
    const ids = KEYBOARD_SHORTCUTS.map((shortcut) => shortcut.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.handler.length).toBeGreaterThan(0);
      expect(shortcut.keys.length).toBeGreaterThan(0);
    }
  });

  test("every scope has at least one shortcut for an Apple admin", () => {
    for (const scope of KEYBOARD_SHORTCUT_SCOPES) {
      expect(keyboardShortcutsByScope(scope, { isAdmin: true, apple: true }).length).toBeGreaterThan(
        0
      );
    }
  });

  test("Ctrl-only bindings that close the tab on Windows and Linux are Apple-only", () => {
    const offApple = visibleKeyboardShortcuts(everyone).map((shortcut) => shortcut.id);
    const onApple = visibleKeyboardShortcuts({ isAdmin: false, apple: true }).map(
      (shortcut) => shortcut.id
    );

    expect(offApple).not.toContain("arcadia-multiagent-board");
    expect(offApple).not.toContain("arcadia-multiagent-chat");
    expect(onApple).toContain("arcadia-multiagent-board");
  });

  test("admin-only shortcuts stay hidden from everyone else", () => {
    expect(visibleKeyboardShortcuts(everyone).map((shortcut) => shortcut.id)).not.toContain("tune");
    expect(
      visibleKeyboardShortcuts({ isAdmin: true, apple: false }).map((shortcut) => shortcut.id)
    ).toContain("tune");
  });
});

describe("platform labels", () => {
  test("mod is Command on Apple and Ctrl elsewhere; ctrl stays Control", () => {
    expect(formatShortcutKey("mod", true)).toBe("⌘");
    expect(formatShortcutKey("mod", false)).toBe("Ctrl");
    expect(formatShortcutKey("ctrl", true)).toBe("⌃");
    expect(formatShortcutKey("ctrl", false)).toBe("Ctrl");
    expect(formatShortcutKey("K", true)).toBe("K");
  });

  test("chords read as words for screen readers", () => {
    expect(describeShortcut(["mod", "shift", "F"], true)).toBe("Command Shift F");
    expect(describeShortcut(["mod", "K"], false)).toBe("Control K");
  });

  test("detects Apple platforms from platform or user agent", () => {
    expect(isApplePlatform({ platform: "MacIntel", userAgent: "" })).toBe(true);
    expect(isApplePlatform({ platform: "", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" })).toBe(
      true
    );
    expect(isApplePlatform({ platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0)" })).toBe(
      false
    );
    expect(isApplePlatform({ platform: "Linux x86_64", userAgent: "X11; Linux" })).toBe(false);
    expect(isApplePlatform(undefined)).toBe(false);
  });
});

/**
 * Global keyboard shortcuts surfaced in Organic Help.
 * Add entries here when wiring new shortcuts — keeps discoverability in one place.
 */

export type KeyboardShortcutScope = "global" | "chat" | "homepage" | "navigation";

export type KeyboardShortcutDefinition = {
  id: string;
  keys: string[];
  label: string;
  hint?: string;
  scope: KeyboardShortcutScope;
  /** Set false to hide from help while keeping the shortcut wired. */
  enabled: boolean;
};

export const KEYBOARD_SHORTCUT_SCOPES: KeyboardShortcutScope[] = [
  "global",
  "navigation",
  "homepage",
  "chat",
];

export const KEYBOARD_SHORTCUT_SCOPE_LABELS: Record<KeyboardShortcutScope, string> = {
  global: "Everywhere",
  navigation: "Navigation",
  homepage: "Home",
  chat: "Chat & composer",
};

export const KEYBOARD_SHORTCUTS: KeyboardShortcutDefinition[] = [
  {
    id: "sidebar-toggle",
    keys: ["⌘", "B"],
    label: "Toggle sidebar",
    hint: "Use Ctrl on Windows/Linux",
    scope: "navigation",
    enabled: true,
  },
  {
    id: "aion-launcher",
    keys: ["⌘", "K"],
    label: "Open command launcher",
    hint: "Jump to chats and actions",
    scope: "global",
    enabled: true,
  },
  {
    id: "homepage-fullview",
    keys: ["Ctrl", "Space"],
    label: "Toggle focus composer on home",
    scope: "homepage",
    enabled: true,
  },
  {
    id: "homepage-escape",
    keys: ["Esc"],
    label: "Exit focus composer",
    scope: "homepage",
    enabled: true,
  },
  {
    id: "hint-dismiss",
    keys: ["Esc"],
    label: "Dismiss a tip",
    scope: "global",
    enabled: true,
  },
  {
    id: "rabbit-focus",
    keys: ["⌘", "⇧", "F"],
    label: "Rabbit hole focus mode",
    hint: "Hides chrome for reading",
    scope: "navigation",
    enabled: true,
  },
  {
    id: "steer-assist",
    keys: ["⌘", "Enter"],
    label: "Steer assist (Noesis)",
    hint: "When steer is available in composer",
    scope: "chat",
    enabled: true,
  },
  {
    id: "send-message",
    keys: ["Enter"],
    label: "Send message",
    hint: "Shift+Enter for newline on desktop",
    scope: "chat",
    enabled: true,
  },
];

export function getEnabledKeyboardShortcuts(): KeyboardShortcutDefinition[] {
  return KEYBOARD_SHORTCUTS.filter((shortcut) => shortcut.enabled);
}

export function getKeyboardShortcutsByScope(
  scope: KeyboardShortcutScope
): KeyboardShortcutDefinition[] {
  return getEnabledKeyboardShortcuts().filter((shortcut) => shortcut.scope === scope);
}

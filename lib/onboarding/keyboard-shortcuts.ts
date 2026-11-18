/**
 * Keyboard shortcuts listed in Guide → Shortcuts. This is documentation, not binding: each entry
 * names the handler it describes, so a reviewer can check the two still agree. Add an entry here
 * when you wire a new shortcut.
 *
 * Keys are tokens so one entry renders correctly everywhere:
 * - `mod`   → ⌘ on Apple platforms, Ctrl elsewhere (handlers that accept metaKey || ctrlKey)
 * - `ctrl`  → Control on Apple platforms, Ctrl elsewhere (handlers that require ctrlKey)
 * - `alt`   → ⌥ / Alt
 * - `shift` → ⇧ / Shift
 * Anything else is printed as written.
 */

export type KeyboardShortcutScope =
  | "everywhere"
  | "chat"
  | "home"
  | "rabbit-holes"
  | "speak"
  | "ergon";

export type ShortcutKeyToken = "mod" | "ctrl" | "alt" | "shift" | (string & {});

export type KeyboardShortcutDefinition = {
  id: string;
  keys: ShortcutKeyToken[];
  label: string;
  hint?: string;
  scope: KeyboardShortcutScope;
  /** Where the binding lives, for reviewers keeping this list honest. */
  handler: string;
  /** Admin-only surface. */
  adminOnly?: boolean;
  /**
   * Only safe on Apple platforms. Ctrl-only bindings such as Ctrl+W close the browser tab on
   * Windows and Linux, so they are not advertised there.
   */
  appleOnly?: boolean;
};

export const KEYBOARD_SHORTCUT_SCOPES: KeyboardShortcutScope[] = [
  "everywhere",
  "chat",
  "home",
  "rabbit-holes",
  "speak",
  "ergon",
];

export const KEYBOARD_SHORTCUT_SCOPE_LABELS: Record<KeyboardShortcutScope, string> = {
  everywhere: "Everywhere",
  chat: "Chat, composer & Arcadia",
  home: "Home",
  "rabbit-holes": "Rabbit Holes",
  speak: "Speak",
  ergon: "Ergon",
};

export const KEYBOARD_SHORTCUTS: KeyboardShortcutDefinition[] = [
  {
    id: "switch-ideas",
    keys: ["mod", "K"],
    label: "Jump to an idea",
    hint: "Reopen a recent thread or start something new",
    scope: "everywhere",
    handler: "components/aion-launcher/aion-launcher.tsx",
  },
  {
    id: "sidebar-toggle",
    keys: ["mod", "B"],
    label: "Show or hide the sidebar",
    scope: "everywhere",
    handler: "components/third-party/ui/sidebar.tsx",
  },
  {
    id: "dismiss",
    keys: ["Esc"],
    label: "Close a tip, menu or dialog",
    scope: "everywhere",
    handler: "Radix dismissable layers",
  },
  {
    id: "send-message",
    keys: ["Enter"],
    label: "Send",
    hint: "Shift+Enter adds a new line",
    scope: "chat",
    handler: "components/third-party/ai-elements/prompt-input.tsx",
  },
  {
    id: "arcadia-chat-settings",
    keys: ["mod", "."],
    label: "Open thread settings",
    hint: "Title, summary and regeneration, in Arcadia",
    scope: "chat",
    handler: "components/chat/chat.tsx",
  },
  {
    id: "arcadia-multiagent-chat",
    keys: ["ctrl", "Q"],
    label: "Show or hide the multiagent chat",
    hint: "Arcadia multiagent",
    scope: "chat",
    handler: "lib/arcadia/multitask/panel-layout.ts",
    appleOnly: true,
  },
  {
    id: "arcadia-multiagent-board",
    keys: ["ctrl", "W"],
    label: "Show or hide the agent board",
    hint: "Arcadia multiagent",
    scope: "chat",
    handler: "lib/arcadia/multitask/panel-layout.ts",
    appleOnly: true,
  },
  {
    id: "tune",
    keys: ["mod", "Enter"],
    label: "Run Tune on your draft",
    hint: "Noesis",
    scope: "chat",
    handler: "components/chat/core-input/core-input.tsx",
    adminOnly: true,
  },
  {
    id: "home-focus-composer",
    keys: ["ctrl", "Space"],
    label: "Expand or collapse the home composer",
    hint: "Esc also collapses it",
    scope: "home",
    handler: "components/pages/home-page-shell.tsx",
  },
  {
    id: "rabbit-focus",
    keys: ["mod", "shift", "F"],
    label: "Focus mode",
    hint: "Hides the path, sources and prompt",
    scope: "rabbit-holes",
    handler: "components/rabbit-holes/RabbitHoleShell.tsx",
  },
  {
    id: "rabbit-assistant",
    keys: ["mod", "alt", "B"],
    label: "Show or hide the assistant panel",
    hint: "Desktop",
    scope: "rabbit-holes",
    handler: "hooks/use-rabbit-hole-desktop-chat-open.tsx",
  },
  {
    id: "speak-primary",
    keys: ["Space"],
    label: "Start the call, or mute and unmute",
    scope: "speak",
    handler: "lib/speak/speak-stage-view.ts",
  },
  {
    id: "speak-mute",
    keys: ["M"],
    label: "Mute or unmute",
    scope: "speak",
    handler: "lib/speak/speak-stage-view.ts",
  },
  {
    id: "speak-transcript",
    keys: ["T"],
    label: "Show or hide the transcript",
    scope: "speak",
    handler: "lib/speak/speak-stage-view.ts",
  },
  {
    id: "ergon-undo",
    keys: ["mod", "Z"],
    label: "Undo",
    hint: "Add Shift to redo",
    scope: "ergon",
    handler: "components/ergon/ErgonPageClient.tsx",
  },
];

export type ShortcutAudience = { isAdmin: boolean; apple: boolean };

export function visibleKeyboardShortcuts(audience: ShortcutAudience): KeyboardShortcutDefinition[] {
  return KEYBOARD_SHORTCUTS.filter(
    (shortcut) =>
      (!shortcut.adminOnly || audience.isAdmin) && (!shortcut.appleOnly || audience.apple)
  );
}

export function keyboardShortcutsByScope(
  scope: KeyboardShortcutScope,
  audience: ShortcutAudience
): KeyboardShortcutDefinition[] {
  return visibleKeyboardShortcuts(audience).filter((shortcut) => shortcut.scope === scope);
}

const APPLE_LABELS: Record<string, string> = { mod: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧" };
const OTHER_LABELS: Record<string, string> = {
  mod: "Ctrl",
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
};

/** Label for one key token on the given platform. */
export function formatShortcutKey(token: ShortcutKeyToken, apple: boolean): string {
  return (apple ? APPLE_LABELS : OTHER_LABELS)[token] ?? token;
}

/** Accessible name for a whole chord, e.g. "Command K" / "Control K". */
export function describeShortcut(keys: readonly ShortcutKeyToken[], apple: boolean): string {
  const words: Record<string, string> = apple
    ? { mod: "Command", ctrl: "Control", alt: "Option", shift: "Shift" }
    : { mod: "Control", ctrl: "Control", alt: "Alt", shift: "Shift" };

  return keys.map((key) => words[key] ?? key).join(" ");
}

/**
 * Apple platform check for shortcut labels. Client-only: callers render a neutral label on the
 * server and swap after mount (see `useIsApplePlatform`).
 */
export function isApplePlatform(
  nav: Pick<Navigator, "platform" | "userAgent"> | undefined
): boolean {
  if (!nav) return false;

  const data = (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = data?.platform || nav.platform || "";

  if (/mac|iphone|ipad|ipod/i.test(platform)) return true;

  return /Mac OS X|iPhone|iPad|iPod/.test(nav.userAgent ?? "");
}

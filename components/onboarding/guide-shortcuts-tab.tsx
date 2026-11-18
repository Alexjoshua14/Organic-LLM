"use client";

import { KeyboardShortcutKbd } from "./keyboard-shortcut-kbd";

import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsApplePlatform } from "@/hooks/use-onboarding";
import {
  KEYBOARD_SHORTCUT_SCOPES,
  KEYBOARD_SHORTCUT_SCOPE_LABELS,
  describeShortcut,
  formatShortcutKey,
  keyboardShortcutsByScope,
} from "@/lib/onboarding/keyboard-shortcuts";

/** Guide → Shortcuts: grouped, labelled for this platform, filtered to what this person can use. */
export function GuideShortcutsTab() {
  const apple = useIsApplePlatform();
  const isAdmin = useIsAdmin() === true;
  const audience = { apple, isAdmin };

  return (
    <div className="flex flex-col gap-stack-2xl px-5 py-5 sm:px-6">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Shortcuts work with a keyboard on desktop.
        {apple ? " ⌘ is Command, ⌥ is Option, ⇧ is Shift and ⌃ is Control." : null}
      </p>
      {KEYBOARD_SHORTCUT_SCOPES.map((scope) => {
        const rows = keyboardShortcutsByScope(scope, audience);

        if (rows.length === 0) return null;

        const headingId = `guide-shortcuts-${scope}`;

        return (
          <section key={scope} aria-labelledby={headingId} className="flex flex-col gap-stack-xs">
            <h3
              className="text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80"
              id={headingId}
            >
              {KEYBOARD_SHORTCUT_SCOPE_LABELS[scope]}
            </h3>
            <ul className="divide-y divide-border/30">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-inline-md py-stack-sm"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{row.label}</p>
                    {row.hint ? (
                      <p className="text-xs leading-snug text-muted-foreground">{row.hint}</p>
                    ) : null}
                  </div>
                  <span
                    aria-label={describeShortcut(row.keys, apple)}
                    className="flex shrink-0 items-center gap-1"
                    role="img"
                  >
                    {row.keys.map((key) => (
                      <KeyboardShortcutKbd key={key}>
                        {formatShortcutKey(key, apple)}
                      </KeyboardShortcutKbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

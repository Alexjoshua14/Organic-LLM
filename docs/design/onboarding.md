# Onboarding: welcome, Guide and feature tips

How Organic teaches itself to new people without getting in their way. Code lives in
`components/onboarding/` and `lib/onboarding/`; the developer guide is
[`content/dev-docs/feature-hints.md`](../../content/dev-docs/feature-hints.md).

## Principles

1. **Pull over push.** Help someone asks for (the Guide) beats help that interrupts them. Push
   only what is needed regardless of context, and only once. (NN/g, *Onboarding tutorials vs.
   contextual help*: push revelations "reveal new information out of context"; prefer help
   "triggered by some signal that the user would benefit from that information at that moment".)
2. **Easy to dismiss, easy to recall.** Every tip can be closed in one action and read again in
   Guide → Tips.
3. **Never block the page.** No dimming, blurring, spotlights or click-catchers. Clicks outside a
   tip reach their target.
4. **Teach where the person already is.** Empty states and the inline welcome do the teaching;
   tips only cover controls that are easy to miss.
5. **Do not explain conventional UI.** A model dropdown or a card with its own description needs
   no tip.

## The three layers

| Layer | When | What |
|-------|------|------|
| Welcome card | Signed-in home, new accounts (≤30 days) or after Replay onboarding | Inline card below the composer: what to do first and where the Guide is. One action, one X. |
| Feature tips | The moment a feature becomes relevant | A small non-modal popover beside one control. Two exist (Search & Memory after the first reply; the multiagent recipient picker). |
| Guide | Whenever someone presses **?** | Start here (what Organic is, first steps, surfaces) · Shortcuts · Tips (every tip, the switch, Replay onboarding). |

Accounts older than 30 days never get the welcome card or automatic tips; the Guide is always
available, and **Replay onboarding** turns both back on (useful before a demo).

## Tip pacing (approved values)

Source of truth: `lib/onboarding/tip-timing.ts`.

| Rule | Value | Why |
|------|-------|-----|
| Route settle | 1200 ms | Layout, data and morphs settle before anything points at them. |
| Idle before showing | 2500 ms | Never appear while someone is typing, scrolling or clicking. Research band for "pause" detection is 2–3 s. |
| Per route visit | 1 tip | No chains. |
| Cooldown between tips | 120 s (across tabs) | Tips should feel occasional. |
| Rolling cap | 2 per 24 h (across tabs) | With two automatic tips this is a ceiling, not a target. |
| Visible re-check | every 1000 ms; closes after 2 failed checks | Tolerates a layout animation without leaving a tip pointing at nothing. |

A tip also waits while: a dialog, sheet, menu, popover or select is open (tooltips do not count); the page is
scroll-locked; another first-visit notice holds onboarding (the anonymous-metrics notice); the tab
is hidden; the Guide is open; or its anchor is not actually visible (off screen, `opacity: 0`,
`visibility: hidden`, or covered at its centre).

## Dismissal

| Action | Result |
|--------|--------|
| **Got it**, **Escape**, using the anchored control | Permanent (versioned; bump the tip's `version` only when its meaning changes). |
| Click elsewhere, the anchor goes away, a route change, another layer opens | Hidden for this tab session. The second time, permanent. |
| **Turn off tips** | Every automatic tip off, with an Undo toast. Back on from Guide → Tips or Quick settings. |

## Motion

| Moment | Value |
|--------|-------|
| Tip enter | 160 ms: opacity, plus a 4 px move away from the anchor (`motion-safe` only) |
| Tip exit | 100 ms: opacity |
| Welcome card enter | default `animate-in` fade + 4 px rise, `motion-safe` only |

Exits are faster than entrances; reduced motion keeps the fade and drops the movement.

## Accessibility

- Tips are `role="dialog"` popovers that never take focus on open (they would steal the caret
  from the composer). While open, the anchored control is `aria-describedby` the tip's text and a
  polite live region announces it with "Press Escape to dismiss".
- Escape closes the topmost layer only (Radix dismissable layers).
- Focus returns to where it came from only if it was inside the tip when it closed.
- Every control uses the shared Lumen focus feedback (`organic-focus`); no focus rings.
- Shortcut chips read as words ("Command K", "Control K") and are labelled for the platform.
  Ctrl-only bindings that close the browser tab on Windows and Linux are listed on Apple only.

## Layering

Tips render at `z-[212]`: above page chrome and the sidebar, below the control cluster (215),
sheets (220) and dialogs (230).

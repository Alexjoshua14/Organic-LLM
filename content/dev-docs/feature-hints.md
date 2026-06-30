# Feature hints (onboarding coachmarks)

First-run **coachmarks** for Organic LLM. Hints register **anchors only** in the existing layout — a global layer renders overlays without shifting page structure.

## Presentation modes

| Mode | Desktop | Mobile | Use when |
|------|---------|--------|----------|
| `spotlight` | Spotlight ring + anchored popover + click-away dismiss | Bottom sheet drawer | UI has a clear anchor (rail, button, composer chip) |
| `toast` | Sonner toast (bottom-right) | Same | Contextual message with no stable anchor (empty states) |

Only **one hint shows at a time**. The priority queue in `lib/onboarding/feature-hint-priority.ts` picks the next eligible hint; when more are waiting, the popover shows a compact page index (e.g. `*1* | · | 3`).

## Guide pacing (hard rule)

**Never auto-chain more than 4 consecutive coachmarks** without unobstructed UI time.

| Rule | Detail |
|------|--------|
| Cap | `MAX_CONSECUTIVE_AUTO_FEATURE_HINTS = 4` in `lib/onboarding/feature-hint-guide-policy.ts` |
| Breath pause | After 4 dismissals on the same surface, auto hints pause until the user clicks/types outside overlays or switches surfaces |
| Beginning exception | First browser session with no prior dismissals — no forced breath pause (first-steps sheet / welcome toast are not coachmarks) |
| Explicit request | Help → **Show next tip**, opening first-steps guide, or Settings → **Tips & coachmarks** bypasses the pause |
| Surface navigation | Moving to another surface (Arcadia → Noesis, etc.) resets the consecutive counter |

Session state lives in `sessionStorage` under `organic-llm-feature-hint-session`. Per-tab dismissals (until replay is toggled on) also live in `organic-llm-feature-hint-session-dismissed`. Dismiss records remain in `localStorage`.

Nav/composer hints (`experience-rail`, `composer-search-memory`, `composer-auto-model`) set `respectDismissInReplay: true` so replay mode re-shows surface tips without re-opening the sidebar/composer chrome on every navigation.

## Developer controls

| Control | Location | Effect |
|---------|----------|--------|
| Global kill switch | `FEATURE_HINTS_MASTER_SWITCH` in `lib/onboarding/feature-hints.ts` | Disables every hint |
| Per-hint switch | `enabled: false` on a hint definition | Disables one hint without removing wiring |
| Copy refresh | Bump hint `version` | Re-shows for users who dismissed an older version |
| Presentation | `presentation: "spotlight" \| "toast"` | Spotlight vs toast-only |
| UI wiring | `featureHints={false}` on `CoreInput` | Skips composer coachmarks for that surface |

## Adding a hint

1. Add an id to `FEATURE_HINT_IDS` and a definition in `FEATURE_HINTS` (`lib/onboarding/feature-hints.ts`).
2. Choose `presentation` and optional `side` / `align` for spotlight hints.
3. Wrap the anchor element (layout unchanged — ref registration only):

```tsx
import { FeatureHint } from "@/components/onboarding/feature-hint";

<FeatureHint id="my-new-hint" showWhen={someProductCondition}>
  <Button>...</Button>
</FeatureHint>
```

4. Optional: gate with `showWhen` so the callout only appears when the feature is relevant (e.g. after the first assistant turn).
5. Add priority in `lib/onboarding/feature-hint-priority.ts` if order matters.
6. Add or extend tests in `tests/unit/feature-hint-storage.test.ts` and `tests/unit/feature-hint-priority.test.ts`.

## Architecture

```
OnboardingHost (app/layout.tsx)
├── FeatureHintRegistryProvider
├── children (unchanged layout)
├── FeatureHintLayer — spotlight / popover / drawer / toast
└── FirstSessionSheet — floating pill + bottom drawer
```

| Area | Path |
|------|------|
| Registry | `lib/onboarding/feature-hints.ts` |
| Priority queue | `lib/onboarding/feature-hint-priority.ts` |
| Queue + pager | `lib/onboarding/feature-hint-queue.ts`, `components/onboarding/feature-hint-queue-indicator.tsx` |
| Session pacing | `lib/onboarding/feature-hint-guide-policy.ts` |
| Session counter | `lib/onboarding/feature-hint-session.ts` |
| Explicit resume | `lib/onboarding/feature-hint-explicit-request.ts` |
| Anchor registry | `lib/onboarding/feature-hint-context.tsx` |
| Storage | `lib/onboarding/feature-hint-storage.ts` |
| Anchor wrapper | `components/onboarding/feature-hint.tsx` |
| Global layer | `components/onboarding/feature-hint-layer.tsx` |
| Host | `components/onboarding/onboarding-host.tsx` |
| Tests | `tests/unit/feature-hint-storage.test.ts`, `tests/unit/feature-hint-priority.test.ts` |

## Persistence

Dismissals are stored in `localStorage` under `organic-llm-feature-hints-dismissed` as `{ [hintId]: dismissedVersion }`.

Reset locally when testing:

```js
localStorage.removeItem("organic-llm-feature-hints-dismissed");
```

Or import `resetFeatureHintDismissals` from `lib/onboarding/feature-hint-storage.ts`.

## Current hints

| Id | Surface | Presentation | Anchor |
|----|---------|--------------|--------|
| `experience-rail` | Sidebar | spotlight | Experience rail |
| `chat-empty-state` | Main chat | toast | — |
| `noesis-sparks` | Noesis empty state | spotlight | Sparks header |
| `noesis-suggest-reply` | Noesis | spotlight | Suggest my reply button |
| `noesis-steer-assist` | Noesis composer | spotlight | Steer assist button |
| `noesis-thread-title` | Noesis (sidebar collapsed) | spotlight | Thread title pill |
| `composer-search-memory` | Shared composer | spotlight | Search + Memory chips |
| `composer-auto-model` | Shared composer | spotlight | Model picker |
| `rabbit-holes-focus` | Rabbit Holes empty state | toast | — |
| `arcadia-starters` | Arcadia empty state | spotlight (blur) | Full style picker + starters |
| `arcadia-style-standard` | Arcadia (Standard selected) | spotlight (blur) | Standard style card |
| `arcadia-style-ergon` | Arcadia (Ergon board selected) | spotlight (blur) | Ergon style card |
| `arcadia-style-scribe` | Arcadia (Scribe selected) | spotlight (blur) | Scribe style card |
| `noesis-sparks` | Noesis empty state | spotlight (blur) | Sparks header + grid |

Surface entry hints wait ~420ms after navigation and take priority over the experience rail and composer hints on that route.

Composer hints apply across chat surfaces using `CoreInput` until dismissed once per browser origin.

## Related NUX

- **Organic Help** — `components/onboarding/organic-help-dialog.tsx` (control cluster **?**)
- **First session** — `components/onboarding/first-session-sheet.tsx` (floating pill + drawer, no home layout changes)
- **Keyboard shortcuts registry** — `lib/onboarding/keyboard-shortcuts.ts`

## Roadmap

- Server-synced dismiss state for signed-in users
- Settings → “Reset tips” for support and QA

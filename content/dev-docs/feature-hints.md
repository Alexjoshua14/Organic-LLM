# Feature hints (onboarding coachmarks)

First-run **coachmarks** for Organic LLM — glass/lumen callouts anchored to UI elements, dismissed per user with **Got it** or **Escape**. On phones, tips become bottom sheets with a light scrim.

## Developer controls

| Control | Location | Effect |
|---------|----------|--------|
| Global kill switch | `FEATURE_HINTS_MASTER_SWITCH` in `lib/onboarding/feature-hints.ts` | Disables every hint |
| Per-hint switch | `enabled: false` on a hint definition | Disables one hint without removing wiring |
| Copy refresh | Bump hint `version` | Re-shows for users who dismissed an older version |
| UI wiring | `featureHints={false}` on `CoreInput` | Skips composer coachmarks for that surface |
| Mobile layout | `mobileBottomSheet: false` on a hint | Keeps anchored positioning on narrow viewports |

## Adding a hint

1. Add an id to `FEATURE_HINT_IDS` and a definition in `FEATURE_HINTS` (`lib/onboarding/feature-hints.ts`).
2. Wrap the anchor element:

```tsx
import { FeatureHint } from "@/components/onboarding/feature-hint";

<FeatureHint id="my-new-hint" showWhen={someProductCondition}>
  <Button>...</Button>
</FeatureHint>
```

3. Optional: gate with `showWhen` so the callout only appears when the feature is relevant (e.g. after the first assistant turn).
4. Add or extend tests in `tests/unit/feature-hint-storage.test.ts`.

## Persistence

Dismissals are stored in `localStorage` under `organic-llm-feature-hints-dismissed` as `{ [hintId]: dismissedVersion }`.

Reset locally when testing:

```js
localStorage.removeItem("organic-llm-feature-hints-dismissed");
```

Or import `resetFeatureHintDismissals` from `lib/onboarding/feature-hint-storage.ts`.

## Current hints

| Id | Surface | Anchor |
|----|---------|--------|
| `experience-rail` | Sidebar | Experience rail (Chat, Arcadia, Noesis, …) |
| `chat-empty-state` | Main chat | Default empty thread guide |
| `noesis-sparks` | Noesis empty state | Sparks header |
| `noesis-suggest-reply` | Noesis | Suggest my reply button |
| `noesis-steer-assist` | Noesis composer | Steer assist button |
| `noesis-thread-title` | Noesis (sidebar collapsed) | Thread title pill |
| `composer-search-memory` | Shared composer | Search + Memory chips |
| `composer-auto-model` | Shared composer | Model picker |
| `rabbit-holes-focus` | Rabbit Holes empty state | Focus mode shortcut |
| `arcadia-starters` | Arcadia empty state | Starter prompts label |

Composer hints apply across chat surfaces using `CoreInput` until dismissed once per browser origin.

## Related NUX

- **Organic Help** — `components/onboarding/organic-help-dialog.tsx` (control cluster **?**)
- **First session checklist** — `components/onboarding/first-session-checklist.tsx` on signed-in home
- **Keyboard shortcuts registry** — `lib/onboarding/keyboard-shortcuts.ts`

## Primary files

| Area | Path |
|------|------|
| Registry | `lib/onboarding/feature-hints.ts` |
| Storage | `lib/onboarding/feature-hint-storage.ts` |
| UI + hook | `components/onboarding/feature-hint.tsx` |
| Tests | `tests/unit/feature-hint-storage.test.ts` |

## Roadmap

- Sequential tours (one hint at a time with priority queue)
- Server-synced dismiss state for signed-in users
- Settings → “Reset tips” for support and QA

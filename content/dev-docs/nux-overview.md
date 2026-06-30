# New user experience (NUX)

In-app onboarding for Organic LLM — overlay-based coachmarks, help dialog, first-session drawer, and welcome explore paths. **Layout is never modified** for guides; overlays, modals, drawers, and toasts sit on top of the permanent UI.

## Surfaces

| Surface | What new users see |
|---------|-------------------|
| Signed-out welcome | Explore-first links (`/showcase`, `/blog`, `/good-news`) |
| Signed-in home | Unchanged layout; first-session pill opens a bottom drawer |
| Control cluster | **?** → Help & shortcuts dialog (modal) |
| Sidebar rail | Tooltips + experience-rail spotlight (desktop popover / mobile sheet) |
| Main chat | Toast on empty thread + composer spotlight hints |
| Noesis / Arcadia / Rabbit Holes | Feature-specific spotlight or toast hints |

Full guides:

- [Feature hints](/dev/docs/feature-hints)
- [Noesis](/dev/docs/noesis)
- [Composer preferences](/dev/docs/composer-preferences)

## Overlay stack

| Layer | Component | Behavior |
|-------|-----------|----------|
| Global hints | `FeatureHintLayer` | One hint at a time; spotlight + popover, mobile sheet, or Sonner toast |
| First session | `FirstSessionSheet` | Floating “First steps” pill + intro toast + checklist drawer |
| Help | `OrganicHelpDialog` | Modal from control cluster |

All mounted once via `OnboardingHost` in `app/layout.tsx`.

## Developer entry points

| Concern | Path |
|---------|------|
| Hint registry | `lib/onboarding/feature-hints.ts` |
| Hint priority | `lib/onboarding/feature-hint-priority.ts` |
| Onboarding host | `components/onboarding/onboarding-host.tsx` |
| Keyboard shortcuts | `lib/onboarding/keyboard-shortcuts.ts` |
| First session state | `lib/onboarding/first-session-storage.ts` |
| Help dialog | `components/onboarding/organic-help-dialog.tsx` |
| Tests | `tests/unit/feature-hint-storage.test.ts`, `tests/unit/feature-hint-priority.test.ts`, `tests/unit/first-session-storage.test.ts`, `tests/unit/keyboard-shortcuts.test.ts` |

## Reset for QA

```js
localStorage.removeItem("organic-llm-feature-hints-dismissed");
localStorage.removeItem("organic-llm-first-session-checklist");
```

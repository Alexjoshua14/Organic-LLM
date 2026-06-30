# New user experience (NUX)

In-app onboarding for Organic LLM — coachmarks, help dialog, first-session checklist, and welcome explore paths.

## Surfaces

| Surface | What new users see |
|---------|-------------------|
| Signed-out welcome | Explore-first links (`/showcase`, `/blog`, `/good-news`) |
| Signed-in home | First-session checklist + primary actions + Showcase gateway |
| Control cluster | **?** → Help & shortcuts dialog |
| Sidebar rail | Tooltips + experience-rail coachmark |
| Main chat | Rich empty state + composer hints |
| Noesis / Arcadia / Rabbit Holes | Feature-specific coachmarks |

Full guides:

- [Feature hints](/dev/docs/feature-hints)
- [Noesis](/dev/docs/noesis)
- [Composer preferences](/dev/docs/composer-preferences)

## Developer entry points

| Concern | Path |
|---------|------|
| Hint registry | `lib/onboarding/feature-hints.ts` |
| Keyboard shortcuts | `lib/onboarding/keyboard-shortcuts.ts` |
| First session state | `lib/onboarding/first-session-storage.ts` |
| Help dialog | `components/onboarding/organic-help-dialog.tsx` |
| Tests | `tests/unit/feature-hint-storage.test.ts`, `tests/unit/first-session-storage.test.ts`, `tests/unit/keyboard-shortcuts.test.ts` |

## Reset for QA

```js
localStorage.removeItem("organic-llm-feature-hints-dismissed");
localStorage.removeItem("organic-llm-first-session-checklist");
```

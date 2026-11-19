# Feature tips

Short pointers that appear the first time a feature matters. Interaction rules, timing and the
reasoning behind them live in the design doc
[`docs/design/onboarding.md`](https://github.com/Alexjoshua14/Organic-LLM/blob/develop/docs/design/onboarding.md);
this page is how to work with the code.

## How a tip appears

1. A component wraps the control in `<FeatureTip id showWhen>`. The wrapper is
   `display: contents`, so layout is unchanged and the child needs no ref forwarding.
2. `FeatureTipLayer` (mounted once by `OnboardingHost`) sees the registered instance. If the
   account is eligible, tips are on, and the tip is not seen or hidden for this session, it waits
   for the route to settle and the person to pause, then checks that nothing else is open and the
   anchor is visible.
3. It shows one Radix popover beside the control. Got it, Escape or using the control dismisses it
   for good; a click elsewhere hides it for this session.

While no tip is waiting, the layer attaches no listeners and runs no timers.

## Adding a tip

Think twice: every automatic tip interrupts someone. Prefer a better empty state, a clearer label,
or a Guide-only tip.

1. Add the id to `AUTO_FEATURE_TIP_IDS` and a definition to `AUTO_FEATURE_TIPS` in
   `lib/onboarding/feature-tips.ts` (order is priority). Keep the title under 32 characters and the
   body under ~200.
2. Wrap the control:

```tsx
import { FeatureTip } from "@/components/onboarding/feature-tip";

<FeatureTip id="my-tip" showWhen={featureIsRelevantNow}>
  <MyControl />
</FeatureTip>;
```

3. Gate `showWhen` on the moment the tip helps (after the first reply, when a mode opens), not on
   page load.
4. Add it to the tests in `tests/unit/guide-content.test.ts` if it has platform or audience rules.

For something people should be able to read but that does not need to interrupt, add a Guide-only
tip to `GUIDE_ONLY_TIPS` instead.

## Changing a tip

- Wording polish: keep `version`. People who dismissed it stay dismissed.
- Meaning changed and people should see it again: bump `version`.
- Retire it: remove the id and its `<FeatureTip>` wrapper.

## Current tips

| Id | Where | Shows when |
|----|-------|------------|
| `composer-search-memory` | Search and Memory toggles | Chat or Arcadia thread has a reply, composer idle and empty, no `/btw` |
| `arcadia-multiagent` | Multiagent recipient picker | Multiagent dashboard open, recipient picker collapsed, composer idle and empty, no `/btw` |

Guide-only tips: sidebar surfaces, ⌘K, Auto model, Rabbit Holes reading mode, and (admins) Noesis
Suggest my reply and Tune.

## State

`lib/onboarding/onboarding-store.ts`, one namespace per signed-in account on each device:

| Key | Holds |
|-----|-------|
| `organic-llm-onboarding:<userId>` (localStorage) | Versioned JSON: tips on/off, seen tips and how they ended, implicit-close counts, tip log (pacing), welcome dismissal, checklist progress, replay flag |
| `organic-llm-onboarding-session:<userId>` (sessionStorage) | Tips hidden for this tab session |

Writes re-read current storage. Browsers with Web Locks also serialize updates and check pacing
in the same transaction that records the impression. On browsers without Web Locks, simultaneous
writes are best effort. If storage is unavailable, state lives in memory for the tab and the welcome
card stays hidden.

The pre-redesign keys (`organic-llm-feature-hints-dismissed`, `organic-llm-first-session-checklist`)
are read once per account for migration and left in place for one release.

## QA

- **Guide → Tips → Replay onboarding** resets tips and the welcome card for your account and
  bypasses the 30-day account window.
- **Guide → Tips → Feature tips** (or Quick settings) turns tips on and off.
- To start from nothing, remove `organic-llm-onboarding:<your user id>` from localStorage.

## Architecture

| Area | Path |
|------|------|
| Tip definitions | `lib/onboarding/feature-tips.ts` |
| State and reducers | `lib/onboarding/onboarding-state.ts` |
| Persistence | `lib/onboarding/onboarding-store.ts` |
| Actions | `lib/onboarding/onboarding-actions.ts` |
| Pacing rules | `lib/onboarding/tip-pacing.ts`, `lib/onboarding/tip-timing.ts` |
| DOM checks | `lib/onboarding/presentability.ts` |
| Anchor registry | `lib/onboarding/feature-tip-registry.ts`, `components/onboarding/feature-tip.tsx` |
| Tip layer and card | `components/onboarding/feature-tip-layer.tsx`, `feature-tip-card.tsx` |
| Host, Guide, welcome | `components/onboarding/onboarding-host.tsx`, `onboarding-guide.tsx`, `welcome-card.tsx` |
| Tests | `tests/unit/onboarding-*.test.ts*`, `tip-pacing.test.ts`, `feature-tip-layer.test.tsx`, `guide-content.test.ts`, `keyboard-shortcuts.test.ts` |

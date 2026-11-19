# New user experience (NUX)

How Organic introduces itself. The rules (why, timing, accessibility) are in
`docs/design/onboarding.md`; tips are covered in [Feature tips](/dev/docs/feature-hints).

## What a new account sees

| Where | What |
|-------|------|
| Signed-out welcome | Explore-first links (`/showcase`, `/blog`, `/good-news`) |
| Signed-in home | An inline welcome card below the composer: what to do first, and **Open the Guide** |
| Control cluster **?** | The Guide: Start here (what Organic is, four first steps, every surface) · Shortcuts · Tips |
| Main chat, empty | The empty state explains Search, Memory and Auto; no tip repeats it |
| After the first reply | One tip on the Search and Memory toggles |
| Arcadia multiagent | One tip on the recipient picker |

Nothing overlays the page except a single small tip, at most one per route visit and two a day.
Accounts older than 30 days get no welcome card or automatic tips; **Guide → Tips → Replay
onboarding** brings them back for any account.

## First steps

Completed by doing the thing, not by clicking its link:

| Step | Completes when |
|------|----------------|
| Ask your first question | A message is sent in Chat or Arcadia |
| Try Arcadia | A message is sent in Arcadia |
| Go down a rabbit hole | The server accepts a new rabbit-hole node |
| Jump between ideas | The ⌘K launcher opens |

## Entry points

| Concern | Path |
|---------|------|
| Host (Guide state, store connection) | `components/onboarding/onboarding-host.tsx` |
| Guide | `components/onboarding/onboarding-guide.tsx` and `guide-*-tab.tsx` |
| Welcome card | `components/onboarding/welcome-card.tsx` |
| First steps | `lib/onboarding/checklist.ts` |
| Surfaces in the Guide | `lib/onboarding/guide-surfaces.ts` |
| Keyboard shortcuts | `lib/onboarding/keyboard-shortcuts.ts` |
| Other notices that hold onboarding | `lib/onboarding/onboarding-blockers.ts` |

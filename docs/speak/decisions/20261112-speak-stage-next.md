# Speak stage, next version

**Status:** Accepted for review (PR). 2026-11-12.

The `/speak` live stage is rebuilt around one question: *can someone who has never seen it
start a call, know whether they are heard, and stop, without reading anything?*

## What changed and why

| Before | Now | Why |
|--------|-----|-----|
| A small grey hint was the only state signal | One large status word plus one sentence, announced through an `aria-live` region | The state of a call is the most important thing on screen |
| Orb animated on a timer, unrelated to sound | Orb scale and halo follow the call's real audio (`SpeakOrb`) | Shows that it hears you; hue carries state |
| Orb and caption remounted on every phase change | Properties animate in place; only the status word cross-fades | Remounting caused a visible flicker each turn |
| Five controls in a row, two with unclear icons | A three-button dock within thumb reach: **Mute · Call/End · New** | One primary action; ending is red and only reachable by the button |
| Settings scattered as chips across the top | One **Call settings** popover with captions, cards, web pages, memory, and reset | Configuration is before the call; the call screen is for the call |
| Budget text line (`$x left · ym today · max zm/session`) | A bar plus `ym left today`, with full detail in the accessible name | One number to read mid-call |
| Transcript was a small box under the controls | Transcript and visuals in a side column on wide screens and a sheet on phones | Reading the conversation is a first-class task |
| Global live bar also rendered on `/speak` | Suppressed while the stage is mounted | Two End buttons for one call |
| No mute | Mute toggles the local track, so the model hears silence | Lets someone cough or talk to a person in the room |

## Behaviour notes

- **Mute does not stop billing timers.** The connection stays up. The existing idle
  auto-pause still ends the call after a quiet stretch, and the muted copy says so. Mute is
  reset when the page unmounts, because no other surface shows the mic is off.
- **Keyboard:** Space starts or resumes a call while idle and mutes while live; M mutes;
  T shows or hides the transcript. No key ends a call. Shortcuts are ignored while typing
  or while a control has focus. Mapping lives in `lib/speak/speak-stage-view.ts`.
- **Panel:** opens by default at `lg` and when a card or page arrives. Whether the visuals
  panel should be present before any tool fires remains an open product question; this
  change does not settle it.
- **Resume:** the "Continuing …" line is unchanged in substance. Resume UX remains
  deliberately deferred.

## Structure

`LiveVoiceStage` reads the session and builds a view model. `SpeakStage` is presentational,
so `/sandbox/prototypes/speak-stage` renders the exact same component in every state, with
an inaudible generated voice driving the orb. Status, primary action, allowance meter, and
shortcut rules are pure functions with unit tests (`tests/unit/speak-stage-view.test.ts`).

Timing constants are in `app/speak/_components/speak-stage-timing.ts`. Status and panel
motion follow the design backbone: brief, exits faster than entrances, and none under reduced
motion. The orb's frame loop runs only while there is a live stream, the tab is visible, and
motion is allowed. It writes `transform` and `opacity` directly and never sets React state.

## Not verified

The redesign has not been exercised in a live call. Check on a phone and a desktop before
merging: real audio response, the mute behaviour against idle pause, and the sheet over the
dock at small heights.

## Follow-up: chrome clearance and a solid agent mark (2026-11-14)

- **Header clearance.** The app's own chrome is absolutely positioned over the page: on phones a
  3.5rem bar with the sidebar toggle at the left and the control cluster at the right; on wider
  screens the toggle floats at the top-left (open or collapsed) and the cluster takes the top-right.
  The Speak header sat under both, which hid the mode switch and persona chip on the left and,
  on desktop, the allowance, transcript and **Call settings** buttons on the right. Those
  settings are where the voice's abilities (captions, cards, web pages, memory) are toggled, so
  they looked missing. `app/speak/_components/speak-chrome-clearance.ts` starts the header below the
  phone bar and, from `md`, leaves room for the toggle and the cluster. If the chrome's size
  changes, change it there. Read aloud uses the same clearance.
- **Agent mark.** See [the mark's design doc](../../design/subagent-identity-mark.md): the hero
  mark's blur kept about a quarter of the dots' ink, and the idle cover washed it to near-invisible.
  Speak now uses `dotWeight` 1.4 and a lighter cover. Modelled, not yet seen live.

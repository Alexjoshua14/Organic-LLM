# ⌘K launcher

The launcher is the app's idea switcher: press ⌘K (Ctrl+K), land on the thing you were
thinking about, or ask for something new. It replaced a stock command-palette list. Tracked in
COA-586.

**Related code**

- Provider and shortcut: [`aion-launcher.tsx`](../../components/aion-launcher/aion-launcher.tsx)
- Surface: [`launcher-surface.tsx`](../../components/aion-launcher/launcher-surface.tsx), mounted in `app/layout.tsx` inside the voice and sidebar providers
- Card: [`launcher-idea-card.tsx`](../../components/aion-launcher/launcher-idea-card.tsx)
- Logic (pure): [`lib/launcher/launcher-ideas.ts`](../../lib/launcher/launcher-ideas.ts)
- Resume cues: [`lib/launcher/launcher-cue-cache.ts`](../../lib/launcher/launcher-cue-cache.ts)
- Timing: [`lib/launcher/launcher-timing.ts`](../../lib/launcher/launcher-timing.ts)

---

## Composition

1. **The real homepage input** (`AIInput`), not a copy. Enter routes semantically exactly as it
   does on the homepage; the launcher only supplies a placeholder and an `onNavigate` callback
   that closes it.
2. **Recent ideas** beneath it: the threads you touched last, as cards. Typing filters and
   reorders them; the best match gets a step in value (never the accent).
3. **The real primary actions** (`HomepagePrimaryActions`, `scope="launcher"`): Let's Chat,
   Rabbit Holes, Strata (admin), Settings.

No list, no dropdown, no groups. The surface sits on a dimmed, blurred backdrop so the page you
are leaving stays present.

## No scroll, ever

The card grid is sized to the viewport, never scrolled:

| Viewport | Cards | Columns |
|----------|-------|---------|
| ≥ 1024px | 5 | 5 |
| ≥ 640px | 4 | 4 |
| phone | 4 | 2 × 2 |

`launcherIdeaLayout` owns the numbers. The thread on screen is never offered.

## A card

Title, one "where you left off" line, age, and the sidebar's own signal. It reuses
[`SessionGlyph`](../../components/sidebar/session-glyph.tsx) and the
[session signal rules](./sidebar-session-signals.md): lights out when idle, one signal at a
time, shape = experience, motion = working, accent = new and nothing else. The resume line's
height is reserved, so a late cue never moves the card.

## Keyboard

| Key | Does |
|-----|------|
| ⌘K / Ctrl+K | Toggle. Works from the chat composer and any text field, since that is where a switch starts; only a `contenteditable` editor keeps it |
| Enter in the input | Route semantically, as on the homepage |
| ↓ at the end of the input | Step into the cards |
| ← → ↑ ↓, Home, End | Move between cards; ↑ from the first row returns to the input |
| Enter / Space on a card | Open it |
| Any character on a card | Back to the input, with the character typed |
| Esc | Close |

Digits are deliberately not shortcuts: with focus in the input they are text, and ⌘1–5 belong
to the browser's tabs.

## Data and freshness

- **Cards come from the sidebar cache** (`useSharedChatContext`, SWR), so they paint with no
  request. Order is recency, not pin order. Signals come from `useSidebarActivity`, which
  revalidates when the launcher mounts, so a thread that is working or has new content says so.
- **Opening is the sidebar's click.** `openLauncherIdea` selects the thread and pushes its
  canonical path. No thread content is ever handed to the page, so a reply that is still
  streaming reattaches through the server-authoritative resume path
  ([thread-session architecture §6](../thread-session-architecture.md)), and a finished
  rabbit hole is simply loaded. Two tests guard it: `openLauncherIdea` in
  `tests/unit/launcher-ideas.test.ts` pins the click to the sidebar's sequence and shows no
  content travels with it, and `tests/integration/chat-stream-initial-load.test.tsx` ("leaving
  and returning to an active Chat / Arcadia thread") drives the real `Chat` away from a
  streaming thread and back, asserting it reattaches and replays what was missed.
- **Resume cues are in memory only.** They are decrypted summaries, and
  [§5](../thread-session-architecture.md) requires a documented policy before decrypted content
  is persisted on the client, so nothing here touches localStorage or IndexedDB. One key
  (user + scope) at a time, one line of at most 160 characters each, revalidated when older than
  60 seconds, never awaited by a card.
- The thread list is revalidated on open at most every 30 seconds (it is rate limited).
- No route prefetch: this Next version skips prefetching dynamic routes without a `loading.tsx`, so it would add server work for no gain. Navigation is still the server-authoritative load a sidebar click does.

## Approved timing

| Token | Value | Why |
|-------|-------|-----|
| `LAUNCHER_ENTER_S` | **0.24s** | Functional band; matches the session tray. |
| `LAUNCHER_EXIT_S` | **0.16s** | Exits faster than entrances. |
| `LAUNCHER_CARD_ENTER_S` / `STAGGER_S` | **0.22s / 0.03s** | Five cards settle in ~0.35s. |

Reduced motion: the surface and cards cross-fade, with no rise.

## Decided

- ⌘K pressed again closes the launcher (owner, 2026-11-12). It does not cycle to the previous
  idea.

## Not here yet

- Strata pages and rabbit-hole sessions that are not threads appear through the semantic input,
  not as cards.
- Persisting cues or thread payloads on-device (IndexedDB) needs a proposal first; see COA-586.

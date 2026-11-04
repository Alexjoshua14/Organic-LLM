# Sidebar session signals

How a sidebar row says what kind of session it is, whether work is happening, and whether
something new arrived — without being opened. Direction chosen 2026-09-25 from a research pass
(aviation annunciators, Braun, Teenage Engineering, Nothing Glyph, Vignelli, Aicher, LCARS,
*Her*); this doc records the rules and approved values.

**Related code**

- Glyphs: [`components/sidebar/session-glyph.tsx`](../../components/sidebar/session-glyph.tsx), [`styles/SessionGlyph.css`](../../styles/SessionGlyph.css)
- Status line: [`components/sidebar/session-signal-tray.tsx`](../../components/sidebar/session-signal-tray.tsx)
- Header summary: [`components/sidebar/sidebar-attention-summary.tsx`](../../components/sidebar/sidebar-attention-summary.tsx)
- Rules: [`lib/sidebar/session-signal.ts`](../../lib/sidebar/session-signal.ts), [`lib/sidebar/session-experience.ts`](../../lib/sidebar/session-experience.ts)
- Timing: [`lib/sidebar/session-signal-timing.ts`](../../lib/sidebar/session-signal-timing.ts)
- Data contract: [thread-session architecture](../thread-session-architecture.md#4-client-cache-contract)

---

## Rules

1. **Lights out.** Idle rows carry no status mark. Anything lit means something happened
   (Airbus "dark cockpit": a blank annunciator means normal).
2. **One channel per meaning.** Shape = which experience. Motion = working. The accent colour
   = new. Nothing else uses the accent in the list (Braun ET66: one accent key).
3. **One signal per row**, by priority: live › paused › working › new › idle.
4. **New latches.** It stays lit until the thread is on screen in a visible tab — then it clears
   on every device. The open thread is never new. Speak is never new (realtime).
5. **Rows grow in place, never move.** Working rows open a one-line status underneath and close
   it when done. The list order is never changed by a signal.
6. **Say what, not just that.** The status line names the work ("Writing article").

## Directing the eye

Salience, strongest first, maps to urgency:

| Channel | Used for | Why it ranks here |
|---------|----------|-------------------|
| Motion | Live call, working | Peripheral vision detects motion first; reserved so it always means "in progress". |
| Accent hue + glow | New | Colour pops without moving; calm enough to wait for the user. |
| Value (title brightness/weight) | New, active | Steps the title forward from `foreground-secondary` without new ink. |
| Shape | Experience type | Read on demand, while scanning the glyph column. |

All marks sit in one column at one size, so the eye learns a single place to look. On desktop
that column is the row's right edge, in the actions slot: hovering or focusing a row fades the
glyph out (150ms) and slides the options menu in from the right (250ms, exit faster than enter),
so the two never share the slot at once. The menu stays up while it is open. On mobile the
same slot shows the glyph on every row except the open thread, which shows the menu instead: its
experience is already on screen. Long-press still opens the menu on any row. The
header summary ("2 new") is the master light: it sits in the existing label row (no layout
shift) and jumps focus to the next lit row.

## Glyph system

Every glyph is drawn on a 16-unit grid, 1.25 stroke, round caps, rendered at 14px — one family
(Aicher / GMUNK grid discipline). The shipped set is "Mass": small fills keep idle marks legible at
14px without leaning on motion. Chat and Arcadia are the unmarked default — the slot is empty at
idle, and a thin ring appears only as an annunciator while working or when something is new.
The proposal comparison lives in the sandbox lab at `/sandbox/prototypes/session-glyphs`.

| Experience | Mark | Working motion idiom |
|------------|------|----------------------|
| Chat, Arcadia | none at idle; thin ring when working / new | sweep — a light segment travels the outline |
| Noesis | topic spark: filled core, rays, partial orbit | sweep |
| Introspection | mirror arc and divider, filled self-dot | sweep |
| Rabbit hole | stem, filled node, forks | grow — parts light in step order: sources → article → branches |
| Strata | three offset parallel lines | cascade |
| Remy | 2×2 stovetop, two burners filled | cascade (clockwise) |
| Voice (Speak) | four filled bars | level while live; bars flatten when paused |
| Other | tinted diamond | breathe |

Four motions plus a fallback — not one per experience — so there is little to learn.

## Approved timing

| Token | Value | Band / rationale |
|-------|-------|------------------|
| `SESSION_GLYPH_CYCLE_S` | **2.4s** | Low end of the 2–5s organic breathing band ([organic presence](../organic-presence.md)); reads as active, not anxious. |
| `SESSION_GLYPH_REST_FRACTION` | **⅓** | Motion 0–66%, hold after. A rest beat reads as calm work, not a spinner (Swiss railway clock stop-to-go). Keyframe literal in CSS — keep in sync. |
| `SESSION_GLYPH_CASCADE_STAGGER_S` | **0.2s** | Sequence stays inside the motion window. |
| `SESSION_GLYPH_LEVEL_CYCLE_S` | **1.2s** | Live voice is presence, not progress; approved 0.9–1.6s. |
| `SESSION_SIGNAL_SETTLE_S` | **0.2s** | Idle ↔ new colour change; micro-feedback band. |
| `SESSION_TRAY_ENTER_S` / `EXIT_S` | **0.24s / 0.16s** | Functional band; exits faster than entrances. |
| `SESSION_ACTIVITY_POLL_WORKING_MS` | **3000ms** | Poll only while working; matches rabbit-hole completion polling. |
| `SESSION_WORKING_STALE_MS` | **5 min** | Abandoned markers stop reading as working (chat streams cap at 30s, node steps at 60s). |

## Reduced motion

Under `prefers-reduced-motion: reduce` every animation stops and each state stays legible
statically: a partial arc for sweep, the current rabbit-hole part at 70%, cascade cells lit.
The status line and screen-reader description carry the words in every mode.

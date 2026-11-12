# Performance journeys

Instrumentation for measuring user journeys, locally (the `?perf=1` HUD) and, for accounts that
share them, as anonymous production timings (see [performance metrics](./perf-metrics.md)):

1. **Page load** — document load of `/`, `/chat/[id]` or `/sandbox/arcadia/[id]` (signed in)
2. **Home → Chat** — Let's Chat / sidebar Chat rail
3. **Home → Arcadia** — any link to `/sandbox/arcadia…`
4. **Switch thread** — a sidebar thread click (`thread-switch`)
5. **Open ⌘K launcher** — keydown to the frame after the surface paints (`launcher-open`)

Phase names and journey ids live in [`lib/perf/journeys.ts`](../lib/perf/journeys.ts).

## Enable

**Collection** is on for every signed-in account that shares anonymous timings (the default after
the first-run notice; Settings → Privacy turns it off). **The HUD, the console log and the
per-tab trace history** remain opt-in: add `?perf=1` to any URL. The flag is sticky per tab (`sessionStorage`). Disable with `?perf=0`.

Works in `bun dev`, `bun start`, and deployed builds. The HUD is **not** auto-on in development.

**Locked — 2026-09-10, amended 2026-11-12 (owner):** The local collector previously required
the perf flag. The owner asked for production metrics without `?perf=1`, so collection now
requires resolved, signed-in auth plus *either* the flag *or* the account's consent to share
anonymous timings. Reporting to the server requires consent specifically; the flag alone never
sends anything. The HUD, console log and sessionStorage history still require the flag.
Original rule: Collection and the HUD require resolved, signed-in auth as well as
the perf flag. Signed-out visits emit no custom perf marks or traces, even with a stored flag.
Sign-out discards the active trace and disconnects the page-load observer. The debug preference
and completed history remain stored per tab.

Signing in within a document enables subsequent navigation journeys, but does not start a
page-load trace for time spent signed out. Load traces only start for initially signed-in
home visits; direct loads of other routes do not create an unfinished home-load trace.
Auth initialization runs before the composer's ready effect, including when auth resolves late.
This scope applies to the custom perf collector; Vercel Analytics is unchanged.

## Headline metric

**Destination composer painted** — when the user can type in the target composer:

| Journey | Headline phase |
|---------|----------------|
| Page load (signed in) | `home:composer-ready` |
| Home → Chat | `chat:ready` |
| Home → Arcadia | `chat:ready` (`experience: arcadia`) |

Secondary phases (WebGL first frame, sidebar chat list, FCP/LCP) are recorded but do not define the headline.

## HUD

A collapsible glass drawer appears on the right when perf is enabled. It survives client navigation.

- **Trace list** — newest first; journey, trigger, headline ms, path at start
- **Expanded row** — client timeline (`+t` from trace start, `Δ` from previous mark) and server phases
- **Copy JSON** — export traces for notes or comparison
- **Clear** — reset the ring buffer

Chrome DevTools Performance panel also shows `ol:<journey>:<phase>` User Timing marks when perf is on.

## How to run trustworthy numbers

1. Prefer **`bun run build && bun start`** over Turbopack dev for comparable timings.
2. Record **warm** runs (after first compile); label cold runs separately.
3. Repeat **5×** and compare **medians**, not single samples.
4. Close DevTools unless you need the waterfall (DevTools can skew timings).

## Server phases

| Phase | Where |
|-------|--------|
| `createChat` | Arcadia creation action and index (`/sandbox/arcadia`); routing is inserted atomically |
| `loadChat` | Chat and Arcadia `[slug]` pages (shared per request via React `cache()`) |

Arcadia creation phases are stashed in-process and merged on `[slug]` after navigation.
The sidebar uses the creation action and navigates straight to the canonical thread; direct
index visits still redirect. On serverless or multi-instance deploys, that gap may appear as
unattributed client time between click and route commit.

## Console logs

Each completed journey logs one JSON line:

```json
{ "event": "perf_journey_complete", "journey": "to-chat", "headlineMs": 842, ... }
```

Same shape as `homepage_route_client` in the homepage semantic router.

## Out of scope

This tooling measures only. Initial-load optimizations are recorded in the
[Chat and Arcadia initial-load decision](./architecture/decisions/20261009-chat-arcadia-initial-load.md).
Further changes, such as route loading boundaries or collapsing create+load on Let's Chat,
should be driven by the traces.

# Performance journeys

Dev-only instrumentation for measuring three user journeys:

1. **Page load** — document load of `/` (signed-in composer)
2. **Home → Chat** — Let's Chat / sidebar Chat rail
3. **Home → Arcadia** — any link to `/sandbox/arcadia…`

Phase names and journey ids live in [`lib/perf/journeys.ts`](../lib/perf/journeys.ts).

## Enable

Add `?perf=1` to any URL. The flag is sticky per tab (`sessionStorage`). Disable with `?perf=0`.

Works in `bun dev`, `bun start`, and deployed builds. The HUD is **not** auto-on in development.

**Locked — 2026-09-10:** Collection and the HUD require resolved, signed-in auth as well as
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
| `createChat` | Arcadia index (`/sandbox/arcadia`) |
| `updateThreadRouting` | Arcadia index |
| `loadChat` | Chat and Arcadia `[slug]` pages (shared per request via React `cache()`) |

Arcadia index phases are stashed in-process and merged on `[slug]` after the redirect. On serverless or multi-instance deploys, that gap may appear as unattributed client time between click and route commit.

## Console logs

Each completed journey logs one JSON line:

```json
{ "event": "perf_journey_complete", "journey": "to-chat", "headlineMs": 842, ... }
```

Same shape as `homepage_route_client` in the homepage semantic router.

## Out of scope

This tooling measures only. It does not change route behavior. Follow-up optimizations (skip Arcadia redirect hop, add Arcadia `loading.tsx`, collapse create+load on Let's Chat) should be driven by what the traces show.

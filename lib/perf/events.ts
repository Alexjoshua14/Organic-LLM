import { z } from "zod";

import { PERF_DURATIONS, PERF_JOURNEYS, PERF_PHASES } from "./journeys";

/**
 * The only shape a performance measurement can take on its way to storage.
 *
 * Privacy is enforced here, by construction, and every consumer shares this one definition:
 * the browser reporter builds events from it, the ingest route validates against it, the
 * database columns mirror it, and the notice users read renders {@link PERF_DISCLOSURE} from
 * it. A field that is not in this file cannot be sent, stored or disclosed.
 *
 * What is deliberately absent: any account, session, thread, message or user id; any URL or
 * path (only a coarse route *template*); any free text; IP address; user agent; and any
 * client-supplied timestamp (the server buckets time itself).
 */

export const PERF_ROUTES = [
  "/",
  "/chat/[id]",
  "/arcadia/[id]",
  "/arcadia",
  "/rabbitholes",
  "/remy",
  "/speak",
  "/settings",
  "/admin",
  "/sandbox",
  "other",
] as const;
export type PerfRoute = (typeof PERF_ROUTES)[number];

/** What started the measurement, from a closed list. Never a path or an id. */
export const PERF_TRIGGERS = [
  "document",
  "lets-chat",
  "aion-navigate",
  "rail-chat",
  "rail-arcadia",
  "sidebar-thread",
  "launcher-shortcut",
  "launcher-card",
  "link",
  "other",
] as const;
export type PerfTrigger = (typeof PERF_TRIGGERS)[number];

export const PERF_DEVICES = ["mobile", "desktop"] as const;
export type PerfDevice = (typeof PERF_DEVICES)[number];

export const PERF_CONNECTIONS = ["slow-2g", "2g", "3g", "4g", "unknown"] as const;
export type PerfConnection = (typeof PERF_CONNECTIONS)[number];

/**
 * Phase names that may be reported: every client mark, the named server phases, and the closed
 * list of durations. A name not in one of these lists cannot be sent.
 */
export const PERF_REPORTABLE_PHASES: readonly string[] = [
  ...Object.values(PERF_PHASES),
  ...Object.values(PERF_DURATIONS),
];

export const PERF_EVENT_KINDS = ["journey", "phase"] as const;
export type PerfEventKind = (typeof PERF_EVENT_KINDS)[number];

/** Upper bound on one timing; anything longer is a stalled tab, not a measurement. */
export const PERF_MAX_MS = 120_000;
export const PERF_MAX_EVENTS_PER_BATCH = 40;
export const PERF_MAX_BODY_BYTES = 16 * 1024;

/** App version only, e.g. `0.12.3`. Never a commit hash, host or user string. */
export const PERF_BUILD_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export const PerfEventSchema = z
  .object({
    kind: z.enum(PERF_EVENT_KINDS),
    journey: z.enum(PERF_JOURNEYS),
    phase: z.string().refine((value) => PERF_REPORTABLE_PHASES.includes(value)),
    route: z.enum(PERF_ROUTES),
    trigger: z.enum(PERF_TRIGGERS),
    device: z.enum(PERF_DEVICES),
    conn: z.enum(PERF_CONNECTIONS),
    build: z.string().regex(PERF_BUILD_PATTERN),
    ms: z.number().int().min(0).max(PERF_MAX_MS),
  })
  .strict();
export type PerfEvent = z.infer<typeof PerfEventSchema>;

export const PerfBatchSchema = z
  .object({ events: z.array(PerfEventSchema).min(1).max(PERF_MAX_EVENTS_PER_BATCH) })
  .strict();

/**
 * Plain-language description of every stored field, in the order the notice shows them.
 * `field` is a column name; a test asserts this list equals the schema's keys plus `hour`,
 * so the notice cannot claim less or more than the code actually stores.
 */
export const PERF_DISCLOSURE: ReadonlyArray<{ field: string; label: string; example: string }> = [
  { field: "ms", label: "How long it took", example: "184 ms" },
  {
    field: "journey",
    label: "Which action",
    example: "opening a chat, loading the home page, opening ⌘K",
  },
  {
    field: "phase",
    label: "Which step of that action, or what it spent time on",
    example: "composer ready, loading fonts, waiting for the server",
  },
  { field: "kind", label: "Whole action or one step", example: "step" },
  { field: "route", label: "The kind of page, never which one", example: "a chat page" },
  { field: "trigger", label: "What started it", example: "a sidebar click" },
  { field: "device", label: "Phone or desktop", example: "desktop" },
  { field: "conn", label: "Connection speed class", example: "4g" },
  { field: "build", label: "App version", example: "0.12.3" },
  { field: "hour", label: "The hour it happened (set by the server)", example: "14:00" },
];

/** Never matches a path segment: ids, slugs and query strings cannot survive templating. */
export function perfRouteTemplate(pathname: string): PerfRoute {
  const path = pathname.split("?")[0].split("#")[0];

  if (path === "/") return "/";
  if (/^\/chat\/[^/]+\/?$/.test(path)) return "/chat/[id]";
  if (/^\/sandbox\/arcadia\/[^/]+\/?$/.test(path)) return "/arcadia/[id]";
  if (/^\/sandbox\/arcadia\/?$/.test(path)) return "/arcadia";
  if (path.startsWith("/sandbox")) return "/sandbox";
  if (path.startsWith("/rabbitholes")) return "/rabbitholes";
  if (path.startsWith("/remy")) return "/remy";
  if (path.startsWith("/speak")) return "/speak";
  if (path.startsWith("/settings")) return "/settings";
  if (path.startsWith("/admin")) return "/admin";

  return "other";
}

/** Maps a free-form trigger (which may embed a path) to the closed list. */
export function perfTriggerKind(raw: string): PerfTrigger {
  if (raw.startsWith("document:")) return "document";
  if (raw.startsWith("link:")) return "link";

  const exact: Record<string, PerfTrigger> = {
    "lets-chat": "lets-chat",
    "aion-navigate": "aion-navigate",
    "rail-chat": "rail-chat",
    "rail-arcadia": "rail-arcadia",
    "sidebar-thread": "sidebar-thread",
    "launcher-shortcut": "launcher-shortcut",
    "launcher-card": "launcher-card",
  };

  return exact[raw] ?? "other";
}

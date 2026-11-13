/** Canonical journey ids — single source of truth for instrumentation and docs. */
export const PERF_JOURNEYS = [
  "load",
  "to-chat",
  "to-arcadia",
  "thread-switch",
  "launcher-open",
] as const;

export type PerfJourneyId = (typeof PERF_JOURNEYS)[number];

/** Client-side phase names (relative to trace start unless noted). */
export const PERF_PHASES = {
  // Navigation / document (load journey)
  navTtfb: "nav:ttfb",
  navFcp: "nav:fcp",
  navLcp: "nav:lcp",
  navDcl: "nav:dcl",
  appHydrated: "app:hydrated",
  navCommitted: "nav:committed",
  navPush: "nav:push",

  // Home load
  homeShellMounted: "home:shell-mounted",
  homeComposerReady: "home:composer-ready",
  chromeFirstFrame: "chrome:first-frame",
  sidebarChatsLoaded: "sidebar:chats-loaded",

  // Chat transition
  chatCreated: "chat:created",
  chatLoadingShown: "chat:loading-shown",
  chatReady: "chat:ready",

  // ⌘K launcher: keydown to the frame after the surface has painted
  launcherReady: "launcher:ready",

  // Fonts: when every font the page asked for has loaded (an offset, like the other marks)
  fontsReady: "fonts:ready",

  // Server phase names (also used in RSC collectors)
  serverCreateChat: "createChat",
  serverUpdateThreadRouting: "updateThreadRouting",
  serverLoadChat: "loadChat",
} as const;

/**
 * Durations: how long something took, in ms, as opposed to the marks above (an offset from the
 * start of the action). The prefix says which kind of span it is, so the dashboard can show
 * "at 800 ms" and "took 800 ms" apart. Every name is a closed-list member; none carries a URL.
 */
export const PERF_DURATIONS = {
  // The click-to-ready path of opening or switching a chat, in back-to-back segments.
  segInput: "seg:input",
  segServer: "seg:server",
  segDownload: "seg:download",
  segCommit: "seg:commit",
  segRender: "seg:render",

  // Inside the server's part of that path (nested inside loadChat / the page).
  srvAuth: "srv:auth",
  srvQuery: "srv:query",
  srvDecrypt: "srv:decrypt",
  srvSettings: "srv:settings",
  srvTitle: "srv:title",

  // Cold document load.
  loadDns: "load:dns",
  loadConnect: "load:connect",
  loadServer: "load:server",
  loadDownload: "load:download",
  lcpLoadDelay: "lcp:load-delay",
  lcpLoadTime: "lcp:load-time",
  lcpRenderDelay: "lcp:render-delay",

  // Time spent with at least one request of that kind in flight (overlap counted once).
  resFont: "res:font",
  resScript: "res:script",
  resCss: "res:css",
  resClerk: "res:clerk",
  resRsc: "res:rsc",
  resThirdParty: "res:third-party",
  apiStreamResume: "api:stream-resume",
  apiMessages: "api:messages",
  apiSidebar: "api:sidebar",
  apiUsage: "api:usage",
  apiOther: "api:other",
  netBusy: "net:busy",

  // Main thread (Chromium only).
  mainBlocking: "main:blocking",
  mainLongest: "main:longest",
} as const;

export type PerfDurationName = (typeof PERF_DURATIONS)[keyof typeof PERF_DURATIONS];

const DURATION_VALUES: readonly string[] = Object.values(PERF_DURATIONS);
const SERVER_PHASE_NAMES: readonly string[] = [
  PERF_PHASES.serverCreateChat,
  PERF_PHASES.serverUpdateThreadRouting,
  PERF_PHASES.serverLoadChat,
];

/** True for a span ("took N ms"); false for a mark ("at N ms from the start"). */
export function isPerfDuration(name: string): boolean {
  return DURATION_VALUES.includes(name) || SERVER_PHASE_NAMES.includes(name);
}

export type PerfPhaseName = (typeof PERF_PHASES)[keyof typeof PERF_PHASES];

export const PERF_JOURNEY_LABELS: Record<PerfJourneyId, string> = {
  load: "Page load",
  "to-chat": "Home → Chat",
  "to-arcadia": "Home → Arcadia",
  "thread-switch": "Switch thread",
  "launcher-open": "Open ⌘K launcher",
};

export const PERF_PHASE_LABELS: Record<string, string> = {
  [PERF_PHASES.navTtfb]: "TTFB",
  [PERF_PHASES.navFcp]: "FCP",
  [PERF_PHASES.navLcp]: "LCP",
  [PERF_PHASES.navDcl]: "DOMContentLoaded",
  [PERF_PHASES.appHydrated]: "App hydrated",
  [PERF_PHASES.navCommitted]: "Route committed",
  [PERF_PHASES.navPush]: "router.push",
  [PERF_PHASES.homeShellMounted]: "Home shell mounted",
  [PERF_PHASES.homeComposerReady]: "Composer ready",
  [PERF_PHASES.chromeFirstFrame]: "Chrome first frame",
  [PERF_PHASES.sidebarChatsLoaded]: "Sidebar chats loaded",
  [PERF_PHASES.chatCreated]: "Chat created",
  [PERF_PHASES.chatLoadingShown]: "Loading spinner shown",
  [PERF_PHASES.chatReady]: "Chat composer ready",
  [PERF_PHASES.launcherReady]: "Launcher ready",
  [PERF_PHASES.serverCreateChat]: "createChat (server)",
  [PERF_PHASES.serverUpdateThreadRouting]: "updateThreadRouting (server)",
  [PERF_PHASES.serverLoadChat]: "loadChat (server)",
  [PERF_PHASES.fontsReady]: "Fonts ready",
  [PERF_DURATIONS.segInput]: "Click to request",
  [PERF_DURATIONS.segServer]: "Waiting for the server",
  [PERF_DURATIONS.segDownload]: "Downloading the page",
  [PERF_DURATIONS.segCommit]: "Route commit",
  [PERF_DURATIONS.segRender]: "Render to ready",
  [PERF_DURATIONS.srvAuth]: "Server: sign-in and database client",
  [PERF_DURATIONS.srvQuery]: "Server: database reads",
  [PERF_DURATIONS.srvDecrypt]: "Server: decrypt and parse",
  [PERF_DURATIONS.srvSettings]: "Server: composer settings",
  [PERF_DURATIONS.srvTitle]: "Server: tab title",
  [PERF_DURATIONS.loadDns]: "DNS lookup",
  [PERF_DURATIONS.loadConnect]: "Connect and TLS",
  [PERF_DURATIONS.loadServer]: "Server response wait",
  [PERF_DURATIONS.loadDownload]: "Document download",
  [PERF_DURATIONS.lcpLoadDelay]: "LCP: waiting to start loading",
  [PERF_DURATIONS.lcpLoadTime]: "LCP: loading the resource",
  [PERF_DURATIONS.lcpRenderDelay]: "LCP: waiting to render",
  [PERF_DURATIONS.resFont]: "Fonts (requests in flight)",
  [PERF_DURATIONS.resScript]: "Scripts (requests in flight)",
  [PERF_DURATIONS.resCss]: "Stylesheets (requests in flight)",
  [PERF_DURATIONS.resClerk]: "Clerk (requests in flight)",
  [PERF_DURATIONS.resRsc]: "Page payloads (requests in flight)",
  [PERF_DURATIONS.resThirdParty]: "Other third parties (requests in flight)",
  [PERF_DURATIONS.apiStreamResume]: "Stream resume check",
  [PERF_DURATIONS.apiMessages]: "Message reads",
  [PERF_DURATIONS.apiSidebar]: "Sidebar reads",
  [PERF_DURATIONS.apiUsage]: "Usage reads",
  [PERF_DURATIONS.apiOther]: "Other API calls",
  [PERF_DURATIONS.netBusy]: "Any request in flight",
  [PERF_DURATIONS.mainBlocking]: "Main thread blocked (long tasks)",
  [PERF_DURATIONS.mainLongest]: "Longest single task",
};

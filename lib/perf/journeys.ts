/** Canonical journey ids — single source of truth for instrumentation and docs. */
export const PERF_JOURNEYS = ["load", "to-chat", "to-arcadia"] as const;

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
  homeWelcomeReady: "home:welcome-ready",
  chromeFirstFrame: "chrome:first-frame",
  sidebarChatsLoaded: "sidebar:chats-loaded",

  // Chat transition
  chatCreated: "chat:created",
  chatLoadingShown: "chat:loading-shown",
  chatReady: "chat:ready",

  // Server phase names (also used in RSC collectors)
  serverCreateChat: "createChat",
  serverUpdateThreadRouting: "updateThreadRouting",
  serverLoadChat: "loadChat",
} as const;

export type PerfPhaseName = (typeof PERF_PHASES)[keyof typeof PERF_PHASES];

export const PERF_JOURNEY_LABELS: Record<PerfJourneyId, string> = {
  load: "Page load",
  "to-chat": "Home → Chat",
  "to-arcadia": "Home → Arcadia",
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
  [PERF_PHASES.homeWelcomeReady]: "Welcome ready",
  [PERF_PHASES.chromeFirstFrame]: "Chrome first frame",
  [PERF_PHASES.sidebarChatsLoaded]: "Sidebar chats loaded",
  [PERF_PHASES.chatCreated]: "Chat created",
  [PERF_PHASES.chatLoadingShown]: "Loading spinner shown",
  [PERF_PHASES.chatReady]: "Chat composer ready",
  [PERF_PHASES.serverCreateChat]: "createChat (server)",
  [PERF_PHASES.serverUpdateThreadRouting]: "updateThreadRouting (server)",
  [PERF_PHASES.serverLoadChat]: "loadChat (server)",
};

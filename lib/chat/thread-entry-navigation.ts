const THREAD_CREATION_PATHS = new Set([
  "/chat",
  "/sandbox/arcadia",
  "/sandbox/topic-explore",
  "/sandbox/spark",
  "/sandbox/morphChat",
  "/sandbox/prototypes/line-list",
]);

/** These entry pages create a thread during render, so only fetch them after navigation. */
export function threadEntryPrefetch(href: string): false | undefined {
  const pathname = href.split(/[?#]/, 1)[0].replace(/\/+$/, "");

  return THREAD_CREATION_PATHS.has(pathname) ? false : undefined;
}

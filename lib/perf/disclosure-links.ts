/**
 * Where the code behind the performance-metrics notice lives, so every claim in it can be
 * checked against the real implementation. The repository is public.
 */
const REPO_BLOB = "https://github.com/Alexjoshua14/Organic-LLM/blob/main";

export const PERF_CODE_LINKS = [
  {
    label: "What can ever be recorded",
    description: "The one schema every measurement must pass, and the closed lists it uses.",
    href: `${REPO_BLOB}/lib/perf/events.ts`,
  },
  {
    label: "What your browser sends",
    description: "Builds each measurement from that schema and drops anything else.",
    href: `${REPO_BLOB}/lib/perf/report.ts`,
  },
  {
    label: "What the server accepts",
    description: "Checks your sign-in and your choice, then stores the numbers without them.",
    href: `${REPO_BLOB}/app/api/perf/ingest/route.ts`,
  },
  {
    label: "How it is stored",
    description: "The tables: no account, chat or session column, and who may read them.",
    href: `${REPO_BLOB}/docs/migrations/perf_metrics.sql`,
  },
] as const;

/** Anchor on the Privacy & Security page that lists every stored field. */
export const PERF_PRIVACY_ANCHOR = "/privacy-and-security#performance-metrics";

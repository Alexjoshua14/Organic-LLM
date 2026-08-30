import "server-only";

import {
  buildServerErrorReport,
  formatServerErrorLog,
  type BuildServerErrorReportInput,
  type ServerErrorReport,
} from "./server-error";
import { recordServerErrorReport } from "./error-store";

/**
 * Build a report, emit it as one greppable JSON log line, and file it in the
 * recent-errors ring buffer that `/admin/errors` reads.
 *
 * Synchronous by design: callers are usually inside an error path that is about to
 * return a response, and the store write is fire-and-forget.
 */
export function reportServerError(input: BuildServerErrorReportInput): ServerErrorReport {
  const report = buildServerErrorReport(input);

  // Deliberately raw: the line must stay parseable as `<tag> <json>` so it can be
  // piped into jq. The shared Logger would prepend its own bracketed prefix.
  // eslint-disable-next-line no-console
  console.error(formatServerErrorLog(report));

  void recordServerErrorReport(report).catch(() => {
    /* best-effort */
  });

  return report;
}

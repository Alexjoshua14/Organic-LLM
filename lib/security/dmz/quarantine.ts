import { randomUUID } from "node:crypto";

import type {
  DmzIntakeRequest,
  DmzQuarantineEntry,
  DmzQuarantineStatus,
} from "./types";
import { isProviderBlacklisted, recordIntakeOutcome } from "./source-reputation";
import { scanDmzIntelligence } from "./scan";
import { DMZ_MAX_INTAKE_CHARS } from "./types";
import { getUserQuarantineRef } from "./quarantine-store";

export type DmzIntakeOptions = DmzIntakeRequest & {
  intakeSummary?: string;
  clipboardMeta?: DmzQuarantineEntry["clipboardMeta"];
};

export function intakeDmzIntelligence(
  userId: string,
  request: DmzIntakeOptions
): { entry: DmzQuarantineEntry; alert?: string; canAutoApprove: boolean } {
  if (isProviderBlacklisted(userId, request.provider)) {
    const scan = scanDmzIntelligence("", DMZ_MAX_INTAKE_CHARS);
    const entry: DmzQuarantineEntry = {
      id: randomUUID(),
      userId,
      provider: request.provider,
      subjectKey: request.subjectKey,
      rawText: request.text,
      sanitizedText: "",
      scan: { ...scan, blocked: true, ok: false },
      status: "blocked",
      createdAt: Date.now(),
      reviewNote: "Source is blacklisted due to repeated malicious submissions",
      intakeSummary: request.intakeSummary,
      clipboardMeta: request.clipboardMeta,
    };

    getUserQuarantineRef(userId).unshift(entry);

    return {
      entry,
      alert: `Submissions from ${request.provider} are blocked — too many prior security flags.`,
      canAutoApprove: false,
    };
  }

  const scan = scanDmzIntelligence(request.text, DMZ_MAX_INTAKE_CHARS);
  const flagged = scan.findings.length > 0;

  recordIntakeOutcome({
    userId,
    provider: request.provider,
    flagged,
    blocked: scan.blocked,
  });

  const status: DmzQuarantineStatus = scan.blocked ? "blocked" : "pending";

  const entry: DmzQuarantineEntry = {
    id: randomUUID(),
    userId,
    provider: request.provider,
    subjectKey: request.subjectKey,
    rawText: request.text,
    sanitizedText: scan.sanitizedText,
    scan,
    status,
    createdAt: Date.now(),
    intakeSummary: request.intakeSummary,
    clipboardMeta: request.clipboardMeta,
  };

  getUserQuarantineRef(userId).unshift(entry);

  let alert: string | undefined;

  if (scan.blocked) {
    alert = `Blocked ${scan.findings.length} threat(s) from ${request.provider}. Content was not admitted.`;
  } else if (flagged) {
    alert = `Quarantined content from ${request.provider} — review findings before approving.`;
  }

  const canAutoApprove = !scan.blocked && !flagged;

  return { entry, alert, canAutoApprove };
}

export function listQuarantineEntries(
  userId: string,
  opts: { subjectKey?: string; status?: DmzQuarantineStatus } = {}
): DmzQuarantineEntry[] {
  let list = getUserQuarantineRef(userId);

  if (opts.subjectKey) {
    list = list.filter((e) => e.subjectKey === opts.subjectKey);
  }

  if (opts.status) {
    list = list.filter((e) => e.status === opts.status);
  }

  return list;
}

export function reviewQuarantineEntry(args: {
  userId: string;
  entryId: string;
  action: "approve" | "reject";
  note?: string;
}): DmzQuarantineEntry | { error: string } {
  const list = getUserQuarantineRef(args.userId);
  const entry = list.find((e) => e.id === args.entryId);

  if (!entry) {
    return { error: "Quarantine entry not found" };
  }

  if (entry.status === "blocked") {
    return { error: "Blocked entries cannot be reviewed" };
  }

  if (entry.status === "approved" || entry.status === "rejected") {
    return { error: "Entry already reviewed" };
  }

  entry.status = args.action === "approve" ? "approved" : "rejected";
  entry.reviewedAt = Date.now();
  entry.reviewNote = args.note;

  return entry;
}

export function getApprovedIntelligence(
  userId: string,
  subjectKey: string
): DmzQuarantineEntry[] {
  return listQuarantineEntries(userId, { subjectKey, status: "approved" });
}

export { resetQuarantineForTests } from "./quarantine-store";

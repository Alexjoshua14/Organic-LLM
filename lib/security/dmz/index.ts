export type {
  DmzConnectionProvider,
  DmzIntakeRequest,
  DmzOutboundQuestionRequest,
  DmzQuarantineEntry,
  DmzQuarantineStatus,
  DmzReviewAction,
  DmzScanFinding,
  DmzScanResult,
  DmzSourceReputation,
  DmzThreatKind,
} from "./types";

export {
  DMZ_BLACKLIST_FLAG_RATIO,
  DMZ_BLACKLIST_MIN_INTAKES,
  DMZ_CONNECTION_PROVIDERS,
  DMZ_MAX_INTAKE_CHARS,
} from "./types";

export { scanDmzIntelligence } from "./scan";
export {
  getApprovedIntelligence,
  intakeDmzIntelligence,
  listQuarantineEntries,
  resetQuarantineForTests,
  reviewQuarantineEntry,
} from "./quarantine";
export {
  getSourceReputation,
  isProviderBlacklisted,
  listSourceReputations,
  recordIntakeOutcome,
  resetSourceReputationForTests,
} from "./source-reputation";
export { DMZ_CONNECTIONS, getDmzConnection, type DmzConnectionMeta } from "./connections";
export {
  buildDmzCursorInstruction,
  buildDmzNotionPastebackGuide,
  buildDmzObsidianPastebackGuide,
  buildDmzOutboundQuestion,
} from "./outbound-question";

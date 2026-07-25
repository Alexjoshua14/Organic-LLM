/** External intelligence providers the user may connect for DMZ transfer. */
export const DMZ_CONNECTION_PROVIDERS = [
  "notion",
  "obsidian",
  "chatgpt",
  "claude",
  "perplexity",
  "cursor",
] as const;

export type DmzConnectionProvider = (typeof DMZ_CONNECTION_PROVIDERS)[number];

export type DmzThreatKind =
  | "prompt_injection"
  | "xss_vector"
  | "script_tag"
  | "suspicious_protocol"
  | "control_chars"
  | "oversized_payload";

export type DmzScanFinding = {
  kind: DmzThreatKind;
  severity: "low" | "medium" | "high";
  message: string;
  excerpt?: string;
};

export type DmzScanResult = {
  ok: boolean;
  findings: DmzScanFinding[];
  sanitizedText: string;
  blocked: boolean;
};

export type DmzQuarantineStatus = "pending" | "approved" | "rejected" | "blocked";

export type DmzQuarantineEntry = {
  id: string;
  userId: string;
  provider: DmzConnectionProvider;
  subjectKey: string;
  rawText: string;
  sanitizedText: string;
  scan: DmzScanResult;
  status: DmzQuarantineStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewNote?: string;
  /** ZDR two-line summary shown after clipboard grab (never the raw paste). */
  intakeSummary?: string;
  clipboardMeta?: {
    charCount: number;
    lineCount: number;
    estimatedTokens: number;
  };
  /** Mem0 ids created when this entry was approved. */
  memoryIds?: string[];
};

export type DmzSourceReputation = {
  provider: DmzConnectionProvider;
  totalIntakes: number;
  flaggedIntakes: number;
  blockedIntakes: number;
  blacklisted: boolean;
  blacklistedAt?: number;
  lastFlagAt?: number;
};

export type DmzOutboundQuestionRequest = {
  subjectKey: string;
  subjectTitle: string;
  question: string;
  context?: string;
};

export type DmzIntakeRequest = {
  provider: DmzConnectionProvider;
  subjectKey: string;
  text: string;
};

export type DmzReviewAction = "approve" | "reject";

export const DMZ_BLACKLIST_FLAG_RATIO = 0.35;
export const DMZ_BLACKLIST_MIN_INTAKES = 5;
export const DMZ_MAX_INTAKE_CHARS = 50_000;

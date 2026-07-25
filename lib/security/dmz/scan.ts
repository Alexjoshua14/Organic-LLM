import { sanitizeUntrustedText } from "@/lib/security/external-content/untrusted";

import type { DmzScanFinding, DmzScanResult } from "./types";

const PROMPT_INJECTION_PATTERNS: Array<{ re: RegExp; message: string }> = [
  {
    re: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    message: "Attempt to override prior instructions",
  },
  {
    re: /disregard\s+(your\s+)?(system|developer)\s+(prompt|instructions?|message)/i,
    message: "Attempt to disregard system instructions",
  },
  {
    re: /you\s+are\s+now\s+(in\s+)?(developer|admin|root|unrestricted)\s+mode/i,
    message: "Role-override injection attempt",
  },
  {
    re: /\b(system|developer)\s*:\s*/i,
    message: "Fake system/developer role prefix",
  },
  {
    re: /reveal\s+(your\s+)?(system\s+prompt|api\s+key|secret|token)/i,
    message: "Credential or prompt exfiltration attempt",
  },
  {
    re: /<\s*system\s*>/i,
    message: "XML-style system tag injection",
  },
];

const XSS_PATTERNS: Array<{ re: RegExp; message: string }> = [
  { re: /<\s*script\b/i, message: "Script tag detected" },
  { re: /javascript\s*:/i, message: "JavaScript protocol detected" },
  { re: /\bon[a-z]+\s*=\s*["']/i, message: "Inline event handler detected" },
  { re: /<\s*iframe\b/i, message: "Iframe tag detected" },
  { re: /data\s*:\s*text\/html/i, message: "Data-URL HTML payload detected" },
];

function excerptAround(text: string, index: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);

  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function scanPatternList(
  text: string,
  patterns: Array<{ re: RegExp; message: string }>,
  kind: DmzScanFinding["kind"],
  severity: DmzScanFinding["severity"]
): DmzScanFinding[] {
  const findings: DmzScanFinding[] = [];

  for (const { re, message } of patterns) {
    const match = re.exec(text);

    if (match) {
      findings.push({
        kind,
        severity,
        message,
        excerpt: excerptAround(text, match.index),
      });
    }
  }

  return findings;
}

/**
 * Security scan for inbound DMZ intelligence.
 * Extends external-content sanitization with injection and XSS heuristics.
 */
export function scanDmzIntelligence(text: string, maxLen = 50_000): DmzScanResult {
  const findings: DmzScanFinding[] = [];

  if (text.length > maxLen) {
    findings.push({
      kind: "oversized_payload",
      severity: "high",
      message: `Payload exceeds ${maxLen} characters`,
    });
  }

  const controlCharMatches = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g);

  if (controlCharMatches && controlCharMatches.length > 0) {
    findings.push({
      kind: "control_chars",
      severity: "low",
      message: `Stripped ${controlCharMatches.length} control character(s)`,
    });
  }

  findings.push(
    ...scanPatternList(text, PROMPT_INJECTION_PATTERNS, "prompt_injection", "high"),
    ...scanPatternList(text, XSS_PATTERNS, "xss_vector", "high")
  );

  const sanitizedText = sanitizeUntrustedText(text, maxLen);

  const hasHighSeverity = findings.some((f) => f.severity === "high");
  const blocked = hasHighSeverity;

  return {
    ok: !blocked,
    findings,
    sanitizedText,
    blocked,
  };
}

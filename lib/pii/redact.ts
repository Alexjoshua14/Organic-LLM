/**
 * PII redaction for text sent to external services (LLM APIs, memory/embedding).
 * Redacted content is replaced with placeholders so context is preserved without exposing PII.
 *
 * Client (before user message is sent, default on):
 * - Redaction is enabled unless NEXT_PUBLIC_REDACT_PII=false
 *
 * Server:
 * - REDACT_PII_IN_MEMORY=true — redact before adding to Mem0
 */

const PLACEHOLDERS = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  ssn: "[SSN]",
  creditCard: "[CARD]",
} as const;

// Order matters: more specific patterns first to avoid partial matches
const PII_PATTERNS: Array<{ pattern: RegExp; placeholder: string }> = [
  // SSN: 123-45-6789 or 123 45 6789
  {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    placeholder: PLACEHOLDERS.ssn,
  },
  // Credit card (4 groups of 4 digits, optional spaces/dashes)
  {
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    placeholder: PLACEHOLDERS.creditCard,
  },
  // Email
  {
    pattern: /\b[\w.+-]+@[\w.-]+\.\w{2,}\b/gi,
    placeholder: PLACEHOLDERS.email,
  },
  // US/NA phone: +1 (123) 456-7890, 123-456-7890, (123) 456-7890, etc.
  {
    pattern:
      /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/g,
    placeholder: PLACEHOLDERS.phone,
  },
];

/**
 * Redacts common PII from a string. Returns a new string with placeholders.
 */
export function redactPII(text: string): string {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const { pattern, placeholder } of PII_PATTERNS) {
    out = out.replace(pattern, placeholder);
  }
  return out;
}

/**
 * Redacts PII in a UIMessage's text parts only. Returns a new message (shallow copy with new parts).
 */
function redactMessageParts(
  parts: Array<{ type: string; text?: string; [k: string]: unknown }>,
): Array<{ type: string; text?: string; [k: string]: unknown }> {
  return parts.map((part) => {
    if (part.type === "text" && typeof part.text === "string") {
      return { ...part, text: redactPII(part.text) };
    }
    return part;
  });
}

/** Minimal shape needed to redact text in message parts/content. */
export type UIMessageLike = {
  role: string;
  parts?: Array<{ type: string; text?: string; [k: string]: unknown }>;
  content?: string;
};

/**
 * Returns a new array of messages with PII redacted in text parts (and legacy content string).
 * Does not mutate the original messages. Preserves the input element type.
 */
export function redactUIMessages<T extends UIMessageLike>(messages: T[]): T[] {
  return messages.map((msg) => {
    const next = { ...msg } as T;
    if (Array.isArray(msg.parts) && msg.parts.length > 0) {
      (next as { parts: typeof msg.parts }).parts = redactMessageParts(
        msg.parts,
      );
    }
    if (typeof msg.content === "string") {
      (next as { content: string }).content = redactPII(msg.content);
    }
    return next;
  });
}

/** Use in client code: redact the message before sending when this is true. Default on; set NEXT_PUBLIC_REDACT_PII=false to disable. */
export function isClientPIIRedactionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REDACT_PII !== "false";
}

export function isRedactPIIInMemoryEnabled(): boolean {
  return process.env.REDACT_PII_IN_MEMORY !== "false";
}

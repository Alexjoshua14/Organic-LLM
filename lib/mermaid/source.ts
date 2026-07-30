/**
 * Pure helpers for Mermaid source hygiene, output extraction, and validation
 * triage. No DOM, React, or server-only imports — safe to use from both client
 * components (the renderer) and server tool code (the generator/validator).
 */

import type { MermaidDiagramDensity, MermaidDiagramPayload } from "@/lib/mermaid/types";

/**
 * Mermaid reserved words that break parsing when used as a bare node /
 * participant / state ID. Kept in sync with the generator system prompt so the
 * model and the runtime agree on what to avoid.
 */
export const MERMAID_RESERVED_IDS = [
  "end",
  "graph",
  "subgraph",
  "class",
  "state",
  "click",
  "style",
  "linkStyle",
  "direction",
  "note",
] as const;

/**
 * Strip `%%{init: ...}%%` directives that set `securityLevel`.
 *
 * The app pins Mermaid's security level itself. An author- or LLM-supplied
 * `securityLevel` (especially `strict`) forces a DOMPurify code path that is
 * missing or minified in some runtimes (`tb.sanitize`), which breaks rendering.
 * Other `%%{init}%%` directives are left untouched.
 */
export function stripMermaidSecurityInitDirectives(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trim();

      if (!t.startsWith("%%")) return true;
      if (!/init\s*:/i.test(t)) return true;

      return !/securityLevel/i.test(t);
    })
    .join("\n");
}

/**
 * Formatting tags the generator is told never to emit. The sanitizer strips
 * them anyway, and they are never valid Mermaid outside a label, so removing
 * them can only move code toward validity.
 */
const MERMAID_FORBIDDEN_INLINE_TAGS =
  /<\/?(?:b|i|u|em|strong|font|span|div|sub|sup|small)\b[^>]*>/gi;

const MERMAID_LINE_BREAK_TAG = /<\s*br\s*\/?\s*>/gi;

/** A whole-line `%%{ ... }%%` directive (init, theme, config). */
const MERMAID_DIRECTIVE_LINE = /^\s*%%\{.*\}%%\s*$/;

/** `click` / `href` interactivity directives, disabled under strict security. */
const MERMAID_INTERACTIVITY_LINE = /^\s*(?:click|href)\b/i;

/**
 * Repair the handful of generator mistakes that are unambiguous enough to fix
 * without understanding the surrounding grammar, so the common case never pays
 * for an LLM fix round trip.
 *
 * Deliberately conservative. Label quoting and reserved-ID renaming (see
 * MERMAID_RESERVED_IDS) need real grammar context, and a wrong rewrite turns
 * valid code into broken code — those stay with the fix model.
 */
export function repairCommonMermaidMistakes(source: string): string {
  return source
    .split("\n")
    .filter((line) => !MERMAID_DIRECTIVE_LINE.test(line))
    .filter((line) => !MERMAID_INTERACTIVITY_LINE.test(line))
    .map((line) =>
      line.replace(MERMAID_LINE_BREAK_TAG, " ").replace(MERMAID_FORBIDDEN_INLINE_TAGS, "")
    )
    .join("\n")
    .trim();
}

/**
 * Strip surrounding markdown code fences and any securityLevel init directive,
 * then apply the deterministic repair pass.
 */
export function normalizeMermaidCode(raw: string): string {
  return repairCommonMermaidMistakes(
    stripMermaidSecurityInitDirectives(
      raw
        .replace(/^```(?:mermaid)?\s*/i, "")
        .replace(/```$/i, "")
        .trim()
    )
  );
}

/**
 * Append the offending source line to a parse error. Mermaid's jison errors
 * carry a 0-indexed `hash.line`; quoting that line gives the fix model a target
 * instead of making it re-derive the location from the message alone.
 */
export function annotateMermaidParseError(message: string, source: string, line?: number): string {
  if (typeof line !== "number" || !Number.isInteger(line) || line < 0) return message;

  const offending = source.split("\n")[line];

  if (offending === undefined || !offending.trim()) return message;

  return `${message}\n\nOffending line ${line + 1}: ${offending.trim()}`;
}

/** Diagram headers we recognize when a tool result is a bare Mermaid string. */
const MERMAID_SOURCE_START =
  /^(?:flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|classDiagram|erDiagram|mindmap|gantt|pie|journey|gitGraph|quadrantChart|timeline)\b/;

/**
 * Pull Mermaid source out of a `make_mermaid_diagram` tool result. The result
 * may be the tool's `{ code }` object, a fenced ```mermaid block, or a bare
 * diagram string — handle all three so the renderer stays resilient to drift.
 */
export function extractMermaidCode(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (MERMAID_SOURCE_START.test(trimmed)) {
      return trimmed;
    }

    const fenceMatch = trimmed.match(/```mermaid\s*([\s\S]*?)```/i);

    if (fenceMatch?.[1]) return fenceMatch[1].trim();

    return null;
  }

  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const overview = o.overviewCode;
    const legacy = o.code;

    if (typeof overview === "string" && overview.trim().length > 0) return overview.trim();
    if (typeof legacy === "string" && legacy.trim().length > 0) return legacy.trim();
  }

  return null;
}

const DENSITY_VALUES = new Set<MermaidDiagramDensity>(["glance", "overview", "detailed"]);

/** Parse dual-source tool output from `make_mermaid_diagram`. */
export function parseMermaidDiagramPayload(value: unknown): MermaidDiagramPayload | null {
  if (!value || typeof value !== "object") return null;

  const o = value as Record<string, unknown>;

  if (o.success !== true) return null;

  const overviewRaw =
    typeof o.overviewCode === "string" ? o.overviewCode : typeof o.code === "string" ? o.code : "";
  const detailedRaw = typeof o.detailedCode === "string" ? o.detailedCode : overviewRaw;

  const overviewCode = overviewRaw.trim();
  const detailedCode = detailedRaw.trim();

  if (!overviewCode || !detailedCode) return null;

  const densityRaw = o.density;

  const density: MermaidDiagramDensity =
    typeof densityRaw === "string" && DENSITY_VALUES.has(densityRaw as MermaidDiagramDensity)
      ? (densityRaw as MermaidDiagramDensity)
      : "overview";

  return {
    success: true,
    density,
    title: typeof o.title === "string" ? o.title : null,
    diagramType: typeof o.diagramType === "string" ? o.diagramType : null,
    overviewCode,
    detailedCode,
    generatorModelId: typeof o.generatorModelId === "string" ? o.generatorModelId : undefined,
    validationError: typeof o.validationError === "string" ? o.validationError : null,
    code: overviewCode,
  };
}

/** Try to parse dual-source JSON from raw generator model text. */
export function parseDualMermaidGeneratorJson(text: string): {
  density?: MermaidDiagramDensity;
  title?: string;
  overviewCode: string;
  detailedCode: string;
} | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const overviewCode =
      typeof parsed.overviewCode === "string"
        ? parsed.overviewCode
        : typeof parsed.code === "string"
          ? parsed.code
          : "";
    const detailedCode =
      typeof parsed.detailedCode === "string" ? parsed.detailedCode : overviewCode;

    if (!overviewCode.trim() || !detailedCode.trim()) return null;

    const densityRaw = parsed.density;

    return {
      density:
        typeof densityRaw === "string" && DENSITY_VALUES.has(densityRaw as MermaidDiagramDensity)
          ? (densityRaw as MermaidDiagramDensity)
          : undefined,
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      overviewCode: overviewCode.trim(),
      detailedCode: detailedCode.trim(),
    };
  } catch {
    return null;
  }
}

export type MermaidValidationErrorKind = "syntax" | "environment";

/**
 * Server-side Mermaid validation depends on browser-only globals (DOMPurify,
 * CSSStyleSheet, window/document) and on khroma being able to parse theme
 * colors. When those are missing, the thrown error describes the *environment*,
 * not the diagram — so callers should fail open (accept the code, let the
 * browser be the source of truth) instead of asking the model to "fix"
 * code that is almost certainly valid.
 */
const MERMAID_ENVIRONMENT_ERROR_PATTERNS: RegExp[] = [
  // khroma cannot parse 3-digit hex (e.g. "#eee") from neutral/base/dark themes.
  /unsupported color format/i,
  // mermaid's bundled DOMPurify has no DOM to operate on server-side.
  /\b(?:sanitize|addhook|removehook|removeallhooks)\b[^.\n]*is not a function/i,
  /cannot read propert(?:y|ies) of undefined \(reading '(?:sanitize|addhook)'\)/i,
  // Missing browser globals the render/measure path reaches for.
  /\b(?:document|window|navigator|self|cssstylesheet|getcomputedstyle|htmlelement|svgelement|domparser)\b\s+is not defined/i,
];

/** Distinguish a real diagram syntax error from a runtime-can't-validate error. */
export function classifyMermaidValidationError(message: string): MermaidValidationErrorKind {
  const normalized = message ?? "";

  return MERMAID_ENVIRONMENT_ERROR_PATTERNS.some((re) => re.test(normalized))
    ? "environment"
    : "syntax";
}

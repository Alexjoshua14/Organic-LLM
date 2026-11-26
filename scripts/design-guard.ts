#!/usr/bin/env -S bun --no-env-file
/**
 * Audits a diff against Organic's design rules (design-backbone rules 5, 8 and 9, Lumen, focus
 * feedback) and reports what an agent should fix, or ask the owner about, before handing UI work
 * back. It reads added lines only, so legacy code is never flagged until someone touches it.
 *
 * Usage (through `bun run design:guard`, which keeps Bun from loading .env.local):
 *   bun run design:guard                          working tree vs HEAD, plus untracked files
 *   bun run design:guard --staged                 staged changes only
 *   bun run design:guard --base origin/develop    everything since the merge base
 *   bun run design:guard --range abc123~1..abc123 one commit or range (a past change, a PR)
 *   bun run design:guard --paths a.tsx,dir/       audit only these paths (shared checkouts)
 *   bun run design:guard --scope "components/chat/core-input/**"
 *                                                 flag changed files the request did not name
 *   bun run design:guard --json                   machine-readable findings
 *
 * Exit code: 1 when there is at least one error, otherwise 0. Warnings need a human judgement.
 * Suppress one line with `design-guard: allow <reason>` (or `allow-next-line <reason>`); that is
 * a documented one-off exception, so it needs the owner's decision first.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export type Severity = "error" | "warn";

export type Finding = {
  rule: string;
  severity: Severity;
  file: string;
  /** 0 for file-level findings. */
  line: number;
  text: string;
  hint: string;
  /** True when the right move is to ask the owner (design-backbone rule 9), not to pick a value. */
  ask?: boolean;
};

export type AddedLine = { line: number; text: string };
export type FileDiff = {
  file: string;
  status: "modified" | "added" | "deleted";
  added: AddedLine[];
  removed: string[];
};

/** Spacing tokens by pixel value, read from the `@theme` block so the guard never drifts. */
export type Tokens = { spacingPx: Map<number, string[]> };

// ---------------------------------------------------------------------------------------------
// Parsing

export function parseDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | undefined;
  let newLine = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(raw);
      current = { file: m?.[2] ?? "", status: "modified", added: [], removed: [] };
      files.push(current);
    } else if (!current) {
      continue;
    } else if (raw.startsWith("new file mode")) {
      current.status = "added";
    } else if (raw.startsWith("deleted file mode")) {
      current.status = "deleted";
    } else if (raw.startsWith("@@")) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
      newLine = m ? Number(m[1]) : 0;
    } else if (raw.startsWith("+++") || raw.startsWith("---")) {
      continue;
    } else if (raw.startsWith("+")) {
      current.added.push({ line: newLine, text: raw.slice(1) });
      newLine += 1;
    } else if (raw.startsWith("-")) {
      current.removed.push(raw.slice(1));
    }
  }
  return files.filter((f) => f.file);
}

export function untrackedAsAdded(file: string, content: string): FileDiff {
  return {
    file,
    status: "added",
    added: content.split("\n").map((text, i) => ({ line: i + 1, text })),
    removed: [],
  };
}

export function loadTokens(globalsCss: string): Tokens {
  const spacingPx = new Map<number, string[]>();
  for (const m of globalsCss.matchAll(/--spacing-(stack|inline|inset)-(\w+):\s*([\d.]+)rem/g)) {
    const px = Math.round(Number(m[3]) * 16);
    spacingPx.set(px, [...(spacingPx.get(px) ?? []), `${m[1]}-${m[2]}`]);
  }
  return { spacingPx };
}

export function globToRegExp(glob: string): RegExp {
  const clean = glob.replace(/^\.\//, "");
  if (!/[*?]/.test(clean)) {
    const dir = clean.endsWith("/") ? clean : `${clean}/`;
    return new RegExp(`^(?:${escapeRe(clean)}|${escapeRe(dir)}.*)$`);
  }
  let out = "";
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i]!;
    if (c === "*" && clean[i + 1] === "*") {
      out += ".*";
      i += 1;
      if (clean[i + 1] === "/") i += 1;
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += escapeRe(c);
  }
  return new RegExp(`^${out}$`);
}

function escapeRe(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------------------------
// Rules

const TOKEN_DEFINITION_FILES = [/^styles\/globals\.css$/, /^lib\/design-tokens\//];
const TIMING_HOMES = /(timing|motion|reflow|physics|design-tokens|^styles\/|^llm\/design\/css\/)/i;
const UI_FILE = /\.(tsx|css)$/;
const SKIP_PATH = /(^|\/)(tests?|node_modules|\.next|docs|public)\//;
const SKIP_FILE = /\.(test|spec|stories)\.[jt]sx?$/;

const SPACING_PROP =
  /^\s*(margin|padding|gap|row-gap|column-gap|width|height|min-width|min-height|max-width|max-height|top|left|right|bottom|inset|font-size|line-height|letter-spacing|border-radius|flex-basis|block-size|inline-size)[\w-]*\s*:/;

const LENGTH = /(?<![\w.#])(-?\d*\.?\d+)(px|rem|em|vh|vw|dvh|dvw|svh|lvh|ch)\b/g;
const ARBITRARY = /[\w:&>_.\-/]*-\[([^\]\s]+)\]/g;
const HEX = /(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb)\(\s*[-\d.%]/gi;
const PALETTE =
  /(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|outline|decoration|divide|accent|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b/g;
const BLACK_WHITE =
  /(?:[a-z0-9-]+:)*(?:bg|text|border|from|via|to|fill|stroke)-(?:white|black)(?:\/\d+)?\b/g;
const HOVER_PREFIX = /(?:^|:)(?:hover|focus|focus-visible|active|group-hover):/;
const FOCUS_RING = /(?:focus|focus-visible|focus-within):(?:[a-z0-9-]+:)*ring\b[\w./[\]#-]*/;
const OUTLINE_OFF = /\b(?:(?:focus|focus-visible):)?outline-(?:none|hidden)\b|\boutline(?:-style)?\s*:\s*(?:none|0)\b/;
const STYLE_PROP_NUMBER =
  /\b(?:width|height|minWidth|minHeight|maxWidth|maxHeight|padding(?:Top|Right|Bottom|Left|Inline|Block)?|margin(?:Top|Right|Bottom|Left|Inline|Block)?|gap|rowGap|columnGap|top|left|right|bottom|inset|fontSize|letterSpacing|borderRadius|flexBasis)\s*:\s*(-?\d*\.?\d+)\s*[,}]/;
const KEEP_FEEDBACK =
  /organic-focus-scope|organic-focus|organic-lumen-interactive|chat-style-lumen-rim|lumen-rim-backlight|--cl-lumen-shadow-\w+|--cl-lumen\b/g;

/** System colors only appear in a forced-colors fallback, which focus-feedback.md mandates. */
const SYSTEM_COLOR = /\b(?:Highlight|HighlightText|CanvasText|Canvas|ButtonText|ButtonFace|LinkText|GrayText)\b/;

const ALLOW = /design-guard:\s*allow(-next-line)?\b[ \t]*(.*)$/;

/** Removes comments and quoted/url content that can hold look-alike values. */
function code(line: string, kind: "css" | "tsx"): string {
  let s = line.replace(/\/\*.*?\*\//g, "").replace(/(?<!:)\/\/.*$/, "");
  s = s.replace(/url\([^)]*\)/g, "url()");
  if (kind === "css") s = s.replace(/"[^"]*"|'[^']*'/g, '""');
  return s;
}

function isCommentLine(line: string): boolean {
  if (/^\s*(\/\*|\/\/)/.test(line)) return true;
  // A JSDoc continuation (`* text`), but not the universal selector (`* {`).
  return /^\s*\*(\s|\/|$)/.test(line) && !/^\s*\*\s*[{,]/.test(line);
}

export function tokenHint(
  px: number,
  tokens: Tokens,
  kind: "css" | "tsx" = "tsx"
): { hint: string; ask: boolean } {
  const names = tokens.spacingPx.get(px);
  if (names) {
    return {
      hint: `${px}px is ${names.join(" / ")}; use the one for the role (stack = vertical rhythm, inline = gaps, inset = padding)`,
      ask: false,
    };
  }
  const scale =
    px % 4 === 0 && px > 0
      ? kind === "css"
        ? ` On the Tailwind scale this is calc(var(--spacing) * ${px / 4}); use it only if the surrounding file sizes this role that way.`
        : ` The Tailwind scale -${px / 4} is ${px}px; use it only if the surrounding file sizes this role that way (min-h-11 = 44px target).`
      : "";
  return {
    hint: `no token at ${px}px.${scale} If it must be exactly this, ask the owner: change a token, add one (propose a name), or record a one-off (design-backbone rule 9).`,
    ask: true,
  };
}

/** The CSS property whose value contains `index`: the nearest `name:` before it in the rule. */
function propertyBefore(s: string, index: number): string | undefined {
  return /([a-z-]+)\s*:[^:;{}]*$/.exec(s.slice(0, index))?.[1];
}

function toPx(value: number, unit: string): number | undefined {
  if (unit === "px") return value;
  if (unit === "rem") return value * 16;
  return undefined;
}

type Ctx = { tokens: Tokens; readFile: (path: string) => string | undefined };

function auditAddedLine(
  file: string,
  kind: "css" | "tsx",
  a: AddedLine,
  ctx: Ctx,
  forcedColors: boolean
): Finding[] {
  const out: Finding[] = [];
  if (isCommentLine(a.text)) return out;
  const s = code(a.text, kind);
  const isTokenFile = TOKEN_DEFINITION_FILES.some((re) => re.test(file));
  const push = (f: Omit<Finding, "file" | "line" | "text">) =>
    out.push({ ...f, file, line: a.line, text: a.text.trim().slice(0, 100) });

  // 1. Lengths in CSS. TSX gets its own checks below because prose and data hold look-alikes.
  if (kind === "css" && !isTokenFile && !/^\s*@(media|container|supports)\b/.test(s)) {
    for (const m of s.matchAll(LENGTH)) {
      const value = Number(m[1]);
      const unit = m[2]!;
      // The declaration this value belongs to, even on a one-line rule (`.a { gap: 6px }`).
      const property = propertyBefore(s, m.index ?? 0);
      const isSpacing = property !== undefined && SPACING_PROP.test(`${property}:`);
      const isBorderHairline = property !== undefined && /^(border|outline|stroke)/.test(property);
      if (value === 0) continue;
      if (property === "box-shadow") continue; // shadow-literal below owns shadows
      if (value === 100 && /^(vh|vw|dvh|dvw|svh|lvh)$/.test(unit)) continue;
      if (value === 1 && unit === "px" && isBorderHairline) continue;
      // A 1px hairline or visually-hidden box has no token; padding, margin and gap still do.
      if (value === 1 && unit === "px" && !/^(padding|margin|gap|row-gap|column-gap)/.test(property ?? "")) continue;
      // The forced-colors fallback outline is deliberate (docs/design/focus-feedback.md).
      if (/^outline/.test(property ?? "") && (SYSTEM_COLOR.test(s) || forcedColors)) continue;
      const { hint, ask } = tokenHint(toPx(value, unit) ?? NaN, ctx.tokens, "css");
      push({
        rule: "literal-length",
        severity: isSpacing ? "error" : "warn",
        hint: Number.isNaN(toPx(value, unit) ?? NaN)
          ? `${m[0]} depends on font or viewport size; take it from a token, or ask the owner (design-backbone rule 9)`
          : hint,
        ask: ask || Number.isNaN(toPx(value, unit) ?? NaN),
      });
    }
  }

  // 2. Tailwind arbitrary values.
  if (kind === "tsx") {
    for (const m of s.matchAll(ARBITRARY)) {
      const token = m[0];
      const inner = m[1]!.replace(/var\([^)]*\)/g, "");
      const utility = token.replace(/^.*:/, "");
      if (/^z-\[/.test(utility)) {
        push({ rule: "arbitrary-z", severity: "warn", hint: "stack relative to a neighbour (one step above or below), not a magic number" });
        continue;
      }
      if (/^(duration|delay|ease)-\[/.test(utility)) {
        if (!TIMING_HOMES.test(file)) {
          push({ rule: "timing-literal", severity: "warn", hint: "timing constants live next to the effect or in the shared timing module (design-backbone rule 5)" });
        }
        continue;
      }
      const unit = /(-?\d*\.?\d+)(px|rem|em|vh|vw|dvh|dvw|svh|lvh|ch)\b/.exec(inner);
      if (unit) {
        if (Number(unit[1]) === 100 && /^(vh|vw|dvh|dvw|svh|lvh)$/.test(unit[2]!)) continue;
        const px = toPx(Number(unit[1]), unit[2]!);
        const t = px === undefined ? undefined : tokenHint(px, ctx.tokens);
        push({
          rule: "arbitrary-value",
          severity: "error",
          hint: t?.hint ?? `${unit[0]} depends on font or viewport size; use a token or ask (design-backbone rule 9)`,
          ask: t?.ask ?? true,
        });
      } else if (/#[0-9a-fA-F]{3,8}|(?:rgb|hsl|oklch|oklab)a?\(\s*[-\d.%]/.test(inner)) {
        push({ rule: "arbitrary-color", severity: "error", hint: "use a semantic color token, not an arbitrary value", ask: true });
      }
    }

    // Inline styles: numbers only on a `style` line (data objects such as image sizes are fine).
    if (/\bstyle\b/.test(s)) {
      const n = STYLE_PROP_NUMBER.exec(s);
      if (n && Number(n[1]) !== 0) {
        const t = tokenHint(Number(n[1]), ctx.tokens);
        push({ rule: "inline-style-literal", severity: "error", hint: t.hint, ask: t.ask });
      }
    }
    for (const m of s.matchAll(/["'`]([^"'`]*?)(-?\d*\.?\d+)(px|rem|em)\b[^"'`]*["'`]/g)) {
      if (!/\b(width|height|padding|margin|gap|top|left|right|bottom|inset|fontSize|borderRadius|minHeight|maxWidth)\b\s*:/.test(s)) continue;
      const px = toPx(Number(m[2]), m[3]!);
      if (px === undefined || Number(m[2]) === 0) continue;
      const t = tokenHint(px, ctx.tokens);
      push({ rule: "inline-style-literal", severity: "error", hint: t.hint, ask: t.ask });
    }
  }

  // 3. Colors.
  if (!isTokenFile) {
    // Arbitrary values were judged above; judging their color again would double-report.
    const withoutArbitrary = s.replace(ARBITRARY, " ");
    for (const re of [HEX, COLOR_FN]) {
      for (const _m of withoutArbitrary.matchAll(re)) {
        push({ rule: "color-literal", severity: "error", hint: "use a semantic color token (bg-background, text-foreground, border-border, Lumen variables); ask if none fits", ask: true });
      }
    }
  }
  for (const m of s.matchAll(PALETTE)) {
    const hover = HOVER_PREFIX.test(m[0]);
    push({
      rule: hover ? "hover-fill-color" : "palette-color",
      severity: hover ? "error" : "warn",
      hint: hover
        ? "hover and focus never change a Lumen surface's fill: dark gets natural light, light gets the shadow (docs/design/lumen.md)"
        : "prefer a semantic token; a named palette hue is an invented color unless a doc names it",
    });
  }
  for (const m of s.matchAll(BLACK_WHITE)) {
    const hover = HOVER_PREFIX.test(m[0]);
    push({
      rule: hover ? "hover-fill-color" : "palette-color",
      severity: hover ? "error" : "warn",
      hint: hover ? "no white flash on hover: use Lumen (docs/design/lumen.md)" : "prefer a semantic token over raw white or black",
    });
  }

  // 4. Focus feedback and shadows.
  if (FOCUS_RING.test(s)) {
    push({ rule: "focus-ring", severity: "error", hint: "keyboard focus is Lumen or a surface/text change, not a ring: use the shared control or `organic-focus` (docs/design/focus-feedback.md)" });
  }
  if (OUTLINE_OFF.test(s) && !/organic-focus/.test(s)) {
    push({ rule: "focus-removed", severity: "warn", hint: "removing an outline needs a visible replacement on the same element (`organic-focus` or a clear surface/text cue)" });
  }
  if (/box-shadow\s*:[^;]*\d(?:px|rem|em)|\bshadow-\[|drop-shadow\([^)]*\d/.test(s) && !/--cl-lumen/.test(s)) {
    push({ rule: "shadow-literal", severity: "warn", hint: "light-mode Lumen is `--cl-lumen-shadow-rest`/`-hover`; a new depth step needs the owner's decision (docs/design/lumen.md rule 4)", ask: true });
  }

  // 5. Timing.
  if (!TIMING_HOMES.test(file)) {
    const timing =
      kind === "css"
        ? /\b(?:transition(?:-duration)?|animation(?:-duration)?|transition-delay)\s*:[^;]*\b\d*\.?\d+m?s\b|cubic-bezier\(/
        : /\bduration\s*:\s*\d|\bdelay\s*:\s*\d|\bease\s*:\s*\[|\bstiffness\s*:\s*\d|\bdamping\s*:\s*\d/;
    if (timing.test(s)) {
      push({ rule: "timing-literal", severity: "warn", hint: "timing constants live next to the effect in a named constant or the shared timing module, with the approved range in the doc (design-backbone rule 5)" });
    }
  }
  return out;
}

function fileKind(file: string): "css" | "tsx" | undefined {
  if (SKIP_PATH.test(file) || SKIP_FILE.test(file)) return undefined;
  if (file.endsWith(".css")) return "css";
  if (file.endsWith(".tsx")) return "tsx";
  return undefined;
}

export type AuditOptions = { scope?: string[] };

export function audit(files: FileDiff[], ctx: Ctx, options: AuditOptions = {}): Finding[] {
  const findings: Finding[] = [];
  const scope = options.scope?.map(globToRegExp);
  const inScopeStems = new Set(
    files.filter((f) => scope?.some((re) => re.test(f.file))).map((f) => stem(f.file))
  );

  for (const f of files) {
    if (scope && f.status !== "deleted" && !scope.some((re) => re.test(f.file))) {
      const testOfInScope = /(^|\/)tests?\//.test(f.file) && inScopeStems.has(stem(f.file));
      if (!testOfInScope) {
        findings.push({ rule: "scope-creep", severity: "warn", file: f.file, line: 0, text: f.status, hint: "changed but not named by the request: revert it, or confirm with the owner that it belongs" });
      }
    } else if (scope && f.status === "deleted" && !scope.some((re) => re.test(f.file))) {
      findings.push({ rule: "scope-creep", severity: "warn", file: f.file, line: 0, text: "deleted", hint: "deleted but not named by the request" });
    }

    const kind = fileKind(f.file);
    if (!kind || f.status === "deleted") continue;

    // Suppression markers.
    const suppressed = new Set<number>();
    for (const a of f.added) {
      const m = ALLOW.exec(a.text);
      if (!m) continue;
      const reason = (m[2] ?? "").replace(/\*\/\s*}?\s*$/, "").trim();
      if (reason.length < 3) {
        findings.push({ rule: "allow-without-reason", severity: "error", file: f.file, line: a.line, text: a.text.trim().slice(0, 100), hint: "an exception needs a reason, and the owner's decision first (design-backbone rule 9)" });
        continue;
      }
      suppressed.add(m[1] ? a.line + 1 : a.line);
    }

    const forcedColors = kind === "css" && /forced-colors/.test(ctx.readFile(f.file) ?? "");
    for (const a of f.added) {
      if (suppressed.has(a.line)) continue;
      findings.push(...auditAddedLine(f.file, kind, a, ctx, forcedColors));
    }

    // Feedback treatments that were removed and not replaced.
    const removedKeep = new Set(f.removed.flatMap((l) => l.match(KEEP_FEEDBACK) ?? []));
    const addedKeep = new Set(f.added.flatMap((a) => a.text.match(KEEP_FEEDBACK) ?? []));
    for (const k of removedKeep) {
      if (!addedKeep.has(k)) {
        findings.push({ rule: "interaction-removed", severity: "warn", file: f.file, line: 0, text: k, hint: "a Lumen or focus treatment was removed and not replaced in this file: confirm that was requested" });
      }
    }

    // A project component or hook that stopped being used (swapped, not just restyled).
    if (f.status === "modified") {
      const current = ctx.readFile(f.file);
      if (current !== undefined) {
        for (const line of f.removed) {
          const m = /^\s*import\s+(?:type\s+)?(.+?)\s+from\s+["']((?:@\/|\.\.?\/)[^"']+)["']/.exec(line);
          if (!m) continue;
          for (const name of importedNames(m[1]!)) {
            if (!/^(?:[A-Z]|use[A-Z])/.test(name)) continue;
            if (!new RegExp(`\\b${name}\\b`).test(current)) {
              findings.push({ rule: "component-swap", severity: "warn", file: f.file, line: 0, text: `${name} from ${m[2]}`, hint: "no longer used in this file: was replacing or removing it part of the request? Put it back if not" });
            }
          }
        }
      }
    }
  }
  return findings;
}

function stem(path: string): string {
  return basename(path).replace(/\.(test|spec)\.[jt]sx?$/, "").replace(/\.[^.]+$/, "");
}

export function importedNames(clause: string): string[] {
  const names: string[] = [];
  const braces = /\{([^}]*)\}/.exec(clause);
  if (braces) {
    for (const part of braces[1]!.split(",")) {
      const alias = part.trim().split(/\s+as\s+/).pop();
      if (alias) names.push(alias.replace(/^type\s+/, ""));
    }
  }
  const rest = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+/, "");
  for (const part of rest.split(",")) {
    const n = part.trim();
    if (n) names.push(n);
  }
  return names;
}

// ---------------------------------------------------------------------------------------------
// Report

export function summarize(findings: Finding[]) {
  const errors = findings.filter((f) => f.severity === "error").length;
  return { errors, warnings: findings.length - errors, files: new Set(findings.map((f) => f.file)).size };
}

export function formatReport(findings: Finding[], audited: number): string {
  if (findings.length === 0) return `design-guard: clean (${audited} added lines audited)`;
  const lines: string[] = [];
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  for (const [file, list] of byFile) {
    lines.push(file);
    for (const f of list.sort((a, b) => a.line - b.line)) {
      const where = f.line ? `L${f.line}` : "file";
      lines.push(`  ${where} ${f.severity} ${f.rule}${f.ask ? " [ask]" : ""}: ${f.text}`);
      lines.push(`      ${f.hint}`);
    }
  }
  const { errors, warnings, files } = summarize(findings);
  lines.push(`design-guard: ${errors} error(s), ${warnings} warning(s) in ${files} file(s); ${audited} added lines audited`);
  if (findings.some((f) => f.ask)) {
    lines.push("[ask] = needs the owner: change a token, add one, or record a one-off. Do not pick a literal yourself.");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------
// CLI

function git(args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
}

function parseArgs(argv: string[]) {
  const opts = { staged: false, json: false, base: "", range: "", paths: [] as string[], scope: [] as string[] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    const next = () => argv[++i] ?? "";
    if (a === "--staged") opts.staged = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--base") opts.base = next();
    else if (a === "--range") opts.range = next();
    else if (a === "--paths") opts.paths = next().split(",").filter(Boolean);
    else if (a === "--scope") opts.scope = next().split(",").filter(Boolean);
    else if (a === "--help" || a === "-h") {
      console.log("see the header of scripts/design-guard.ts");
      process.exit(0);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  process.chdir(root);

  const range = opts.range
    ? opts.range.split("..").filter(Boolean)
    : opts.staged
      ? ["--cached"]
      : opts.base
        ? [git(["merge-base", opts.base, "HEAD"]).trim()]
        : ["HEAD"];
  const pathspec = opts.paths.length ? ["--", ...opts.paths] : [];
  const diff = git(["diff", "--no-color", "--no-ext-diff", "-U0", ...range, ...pathspec]);
  const files = parseDiff(diff);

  if (!opts.staged && !opts.range) {
    const wanted = opts.paths.map((p) => globToRegExp(p));
    for (const path of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) {
      if (wanted.length && !wanted.some((re) => re.test(path))) continue;
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8");
      if (text.length > 200_000) continue;
      files.push(untrackedAsAdded(path, text));
    }
  }

  const globals = resolve(root, "styles/globals.css");
  const tokens = loadTokens(existsSync(globals) ? readFileSync(globals, "utf8") : "");
  const findings = audit(
    files,
    { tokens, readFile: (p) => (existsSync(p) ? readFileSync(p, "utf8") : undefined) },
    { scope: opts.scope.length ? opts.scope : undefined }
  );
  const audited = files.reduce((n, f) => n + f.added.length, 0);

  if (opts.json) console.log(JSON.stringify({ summary: summarize(findings), findings }, null, 2));
  else console.log(formatReport(findings, audited));
  process.exit(summarize(findings).errors > 0 ? 1 : 0);
}

if (import.meta.main) main();

"use client";

import type { CSSProperties } from "react";

import { memo } from "react";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import createElement from "react-syntax-highlighter/dist/esm/create-element";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import diff from "react-syntax-highlighter/dist/esm/languages/prism/diff";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";

import styles from "./code-block.module.css";

/**
 * Highlighting uses the Prism *light* build with a short, explicit grammar list so the chat
 * bundle does not carry every language. Output is class-based (`token keyword`), never inline
 * styles: the palette lives in `code-block.module.css`, so light/dark switching is pure CSS.
 */
const GRAMMARS = {
  bash,
  c,
  cpp,
  css,
  diff,
  go,
  java,
  javascript,
  json,
  jsx,
  markdown,
  markup,
  python,
  rust,
  sql,
  tsx,
  typescript,
  yaml,
} as const;

type HighlightLanguage = keyof typeof GRAMMARS;

for (const [name, grammar] of Object.entries(GRAMMARS)) {
  SyntaxHighlighter.registerLanguage(name, grammar);
}

const ALIASES: Record<string, HighlightLanguage> = {
  ts: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  py: "python",
  yml: "yaml",
  html: "markup",
  xml: "markup",
  svg: "markup",
  md: "markdown",
  rs: "rust",
  golang: "go",
  "c++": "cpp",
  patch: "diff",
};

/** Display names for the header. Unknown languages fall back to the fence's own label. */
const LABELS: Record<string, string> = {
  bash: "Shell",
  c: "C",
  cpp: "C++",
  css: "CSS",
  diff: "Diff",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  markdown: "Markdown",
  markup: "HTML",
  python: "Python",
  rust: "Rust",
  sql: "SQL",
  tsx: "TSX",
  typescript: "TypeScript",
  yaml: "YAML",
};

/** Canonical grammar for a fence label (`ts`, `TypeScript`, `language-ts`), or undefined. */
export function resolveHighlightLanguage(
  language: string | undefined
): HighlightLanguage | undefined {
  const key = language
    ?.trim()
    .toLowerCase()
    .replace(/^language-/, "");

  if (!key) return undefined;
  if (key in GRAMMARS) return key as HighlightLanguage;

  return ALIASES[key];
}

/** Human label for the header: "TypeScript" for `ts`, the raw fence label otherwise. */
export function codeLanguageLabel(language: string | undefined): string {
  const resolved = resolveHighlightLanguage(language);

  if (resolved) return LABELS[resolved];

  const raw = language?.trim().replace(/^language-/, "");

  if (!raw || /^(text|txt|plain|plaintext)$/i.test(raw)) return "Code";

  return raw.length <= 3 ? raw.toUpperCase() : raw[0].toUpperCase() + raw.slice(1);
}

type HastNode = {
  type: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
  value?: string;
};

function indentColumns(line: string): CSSProperties {
  return { "--indent-columns": line.match(/^ */)?.[0].length ?? 0 } as CSSProperties;
}

export type CodeLinesProps = {
  /** Source text without its trailing newline. */
  code: string;
  language?: string;
  showLineNumbers: boolean;
};

/**
 * One grid row per source line: optional gutter number plus a `<code>` carrying the tokens.
 * Memoized on its three inputs so a settled block does not re-tokenize when a later markdown
 * block streams in.
 */
export const CodeLines = memo(function CodeLines({
  code,
  language,
  showLineNumbers,
}: CodeLinesProps) {
  const grammar = resolveHighlightLanguage(language);
  const sourceLines = code.split("\n");
  const gutter = {
    "--number-width": `${String(sourceLines.length).length + 1}ch`,
  } as CSSProperties;

  function renderLines(rows: HastNode[] | null) {
    return (
      <div className={styles.lines} style={gutter}>
        {sourceLines.map((line, index) => {
          const row = rows?.[index];

          return (
            <div key={index} className={styles.line} style={indentColumns(line)}>
              {showLineNumbers && (
                <span className={styles.number} aria-hidden>
                  {index + 1}
                </span>
              )}
              <code>
                {row?.children && line
                  ? row.children.map((node, nodeIndex) =>
                      createElement({
                        node: node as never,
                        stylesheet: {},
                        useInlineStyles: false,
                        key: nodeIndex,
                      })
                    )
                  : line || "​"}
              </code>
            </div>
          );
        })}
      </div>
    );
  }

  if (!grammar) return renderLines(null);

  return (
    <SyntaxHighlighter
      PreTag={Passthrough}
      CodeTag={Passthrough}
      language={grammar}
      renderer={({ rows }) => renderLines(rows as unknown as HastNode[])}
      useInlineStyles={false}
      wrapLines
    >
      {code}
    </SyntaxHighlighter>
  );
});

function Passthrough({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

// ── Single-line text (code diff rows) ─────────────────────

const EXTENSIONS: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "css",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  md: "markdown",
  mdx: "markdown",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  diff: "diff",
  patch: "diff",
};

/** Fence-style language for a file path (`lib/a.ts` → `typescript`), or undefined if unknown. */
export function languageForPath(path: string | undefined): string | undefined {
  const base = path?.split(/[\\/]/).pop() ?? "";
  const extension = base.includes(".") ? base.split(".").pop()?.toLowerCase() : undefined;

  return extension ? EXTENSIONS[extension] : undefined;
}

/** A run of text with the Prism classes it inherited from its ancestors. */
export type TokenSegment = { text: string; className: string };

/** Flattens a Prism hast tree into ordered, class-carrying text runs. */
export function flattenTokens(nodes: HastNode[], inherited = ""): TokenSegment[] {
  const segments: TokenSegment[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      if (node.value) segments.push({ text: node.value, className: inherited });
      continue;
    }
    const own = node.properties?.className?.join(" ") ?? "";

    segments.push(...flattenTokens(node.children ?? [], `${inherited} ${own}`.trim()));
  }

  return segments;
}

/** Splits runs at the emphasis boundaries: [before, inside, after]. Offsets are in characters. */
export function splitSegments(
  segments: TokenSegment[],
  range: readonly [number, number] | null
): [TokenSegment[], TokenSegment[], TokenSegment[]] {
  if (!range) return [segments, [], []];

  const parts: [TokenSegment[], TokenSegment[], TokenSegment[]] = [[], [], []];
  let offset = 0;

  for (const segment of segments) {
    const end = offset + segment.text.length;
    const cuts = [range[0], range[1]].filter((cut) => cut > offset && cut < end);
    let from = 0;

    for (const bound of [...cuts.map((cut) => cut - offset), segment.text.length]) {
      const text = segment.text.slice(from, bound);
      const at = offset + from;

      if (text) parts[at < range[0] ? 0 : at < range[1] ? 1 : 2].push({ ...segment, text });
      from = bound;
    }
    offset = end;
  }

  return parts;
}

function renderSegments(segments: TokenSegment[]) {
  return segments.map((segment, index) =>
    segment.className ? (
      <span key={index} className={segment.className}>
        {segment.text}
      </span>
    ) : (
      segment.text
    )
  );
}

export type HighlightedTextProps = {
  text: string;
  language?: string;
  /** Character range to emphasise (the changed span of a diff line). */
  emphasis?: readonly [number, number] | null;
  /** Class for the emphasis wrapper; it also gets `data-emphasis`. */
  emphasisClassName?: string;
};

/**
 * One line of code as tokens, with an optional emphasised span wrapped around the characters that
 * changed. Unknown language: plain text, still emphasised. Text only; never markup.
 */
export const HighlightedText = memo(function HighlightedText({
  text,
  language,
  emphasis = null,
  emphasisClassName,
}: HighlightedTextProps) {
  const grammar = resolveHighlightLanguage(language);

  function render(segments: TokenSegment[]) {
    const [before, inside, after] = splitSegments(segments, emphasis);

    return (
      <>
        {renderSegments(before)}
        {inside.length > 0 && (
          <span className={emphasisClassName} data-emphasis="true">
            {renderSegments(inside)}
          </span>
        )}
        {renderSegments(after)}
      </>
    );
  }

  if (!grammar) return render([{ text, className: "" }]);

  return (
    <SyntaxHighlighter
      PreTag={Passthrough}
      CodeTag={Passthrough}
      language={grammar}
      renderer={({ rows }) => render(flattenTokens(rows as unknown as HastNode[]))}
      useInlineStyles={false}
    >
      {text}
    </SyntaxHighlighter>
  );
});

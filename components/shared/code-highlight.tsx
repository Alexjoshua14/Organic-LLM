"use client";

import type { ReactNode } from "react";

import { Component, memo, useEffect, useState } from "react";
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

import { CodePlain, CodeRow, CodeTable } from "./code/code-table";

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

type StaticLanguage = keyof typeof GRAMMARS;

for (const [name, grammar] of Object.entries(GRAMMARS)) {
  SyntaxHighlighter.registerLanguage(name, grammar);
}

/**
 * The long tail loads on demand (one chunk each), so the chat route does not carry every grammar.
 * Until a grammar arrives its block renders as plain text, then colors in place; once loaded it
 * is registered for the rest of the session.
 */
const LAZY_GRAMMARS = {
  csharp: () => import("react-syntax-highlighter/dist/esm/languages/prism/csharp"),
  ruby: () => import("react-syntax-highlighter/dist/esm/languages/prism/ruby"),
  php: () => import("react-syntax-highlighter/dist/esm/languages/prism/php"),
  swift: () => import("react-syntax-highlighter/dist/esm/languages/prism/swift"),
  kotlin: () => import("react-syntax-highlighter/dist/esm/languages/prism/kotlin"),
  scala: () => import("react-syntax-highlighter/dist/esm/languages/prism/scala"),
  dart: () => import("react-syntax-highlighter/dist/esm/languages/prism/dart"),
  lua: () => import("react-syntax-highlighter/dist/esm/languages/prism/lua"),
  perl: () => import("react-syntax-highlighter/dist/esm/languages/prism/perl"),
  r: () => import("react-syntax-highlighter/dist/esm/languages/prism/r"),
  haskell: () => import("react-syntax-highlighter/dist/esm/languages/prism/haskell"),
  elixir: () => import("react-syntax-highlighter/dist/esm/languages/prism/elixir"),
  powershell: () => import("react-syntax-highlighter/dist/esm/languages/prism/powershell"),
  docker: () => import("react-syntax-highlighter/dist/esm/languages/prism/docker"),
  toml: () => import("react-syntax-highlighter/dist/esm/languages/prism/toml"),
  ini: () => import("react-syntax-highlighter/dist/esm/languages/prism/ini"),
  graphql: () => import("react-syntax-highlighter/dist/esm/languages/prism/graphql"),
  scss: () => import("react-syntax-highlighter/dist/esm/languages/prism/scss"),
  less: () => import("react-syntax-highlighter/dist/esm/languages/prism/less"),
  makefile: () => import("react-syntax-highlighter/dist/esm/languages/prism/makefile"),
  objectivec: () => import("react-syntax-highlighter/dist/esm/languages/prism/objectivec"),
  protobuf: () => import("react-syntax-highlighter/dist/esm/languages/prism/protobuf"),
  hcl: () => import("react-syntax-highlighter/dist/esm/languages/prism/hcl"),
  zig: () => import("react-syntax-highlighter/dist/esm/languages/prism/zig"),
  julia: () => import("react-syntax-highlighter/dist/esm/languages/prism/julia"),
  clojure: () => import("react-syntax-highlighter/dist/esm/languages/prism/clojure"),
  ocaml: () => import("react-syntax-highlighter/dist/esm/languages/prism/ocaml"),
  groovy: () => import("react-syntax-highlighter/dist/esm/languages/prism/groovy"),
  nginx: () => import("react-syntax-highlighter/dist/esm/languages/prism/nginx"),
  http: () => import("react-syntax-highlighter/dist/esm/languages/prism/http"),
  solidity: () => import("react-syntax-highlighter/dist/esm/languages/prism/solidity"),
  vim: () => import("react-syntax-highlighter/dist/esm/languages/prism/vim"),
  latex: () => import("react-syntax-highlighter/dist/esm/languages/prism/latex"),
} as const satisfies Record<string, () => Promise<{ default: unknown }>>;

type LazyLanguage = keyof typeof LAZY_GRAMMARS;
type HighlightLanguage = StaticLanguage | LazyLanguage;

/** Every language this module can highlight, bundled or lazy. */
export const HIGHLIGHT_LANGUAGES: ReadonlyArray<HighlightLanguage> = [
  ...(Object.keys(GRAMMARS) as StaticLanguage[]),
  ...(Object.keys(LAZY_GRAMMARS) as LazyLanguage[]),
];

const ready = new Set<string>(Object.keys(GRAMMARS));
const loading = new Map<string, Promise<void>>();

function loadGrammar(name: LazyLanguage): Promise<void> {
  const pending = loading.get(name);

  if (pending) return pending;

  const load = LAZY_GRAMMARS[name]()
    .then((module) => {
      if (!module?.default) return;
      SyntaxHighlighter.registerLanguage(name, module.default);
      ready.add(name);
    })
    // A failed chunk leaves the block plain; nothing retries in a loop.
    .catch(() => {});

  loading.set(name, load);

  return load;
}

/** Loads a grammar ahead of use. Resolves true when the language is ready to highlight. */
export async function preloadLanguage(language: string | undefined): Promise<boolean> {
  const resolved = resolveHighlightLanguage(language);

  if (!resolved) return false;
  if (!ready.has(resolved)) await loadGrammar(resolved as LazyLanguage);

  return ready.has(resolved);
}

/** The grammar to highlight with right now: undefined while a lazy one is still loading. */
function useGrammar(language: string | undefined): HighlightLanguage | undefined {
  const resolved = resolveHighlightLanguage(language);
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!resolved || ready.has(resolved)) return;

    let cancelled = false;

    void loadGrammar(resolved as LazyLanguage).then(() => {
      if (!cancelled) rerender((count) => count + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [resolved]);

  return resolved && ready.has(resolved) ? resolved : undefined;
}

/**
 * Lookups key off text a model or a file path supplies, so they must never reach inherited
 * properties: `"constructor" in table` is true, and `table["__proto__"]` is not a grammar.
 */
function own(table: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(table, key);
}

/**
 * Highlighting is regex work on the main thread, so its input is bounded. Past a limit the block
 * renders as plain text, which costs one text node however large it is.
 */
export const HIGHLIGHT_LIMITS = {
  /** Characters in one block (about 2,500 lines of typical code, roughly 100-200 ms to tokenize). */
  blockChars: 100_000,
  /** Lines in one block; also bounds the per-line DOM. */
  blockLines: 2_500,
  /** Characters in one diff line, which is tokenized on its own. */
  lineChars: 5_000,
  /** Characters of a fence label shown in the header. */
  labelChars: 24,
} as const;

/** Lines in `text`, counted without allocating one string per line. */
export function countLines(text: string): number {
  if (text === "") return 0;

  let lines = 1;

  for (let at = text.indexOf("\n"); at !== -1; at = text.indexOf("\n", at + 1)) lines += 1;

  return lines;
}

/** True when `code` is too large to tokenize or lay out row by row. */
export function exceedsHighlightLimits(code: string): boolean {
  return (
    code.length > HIGHLIGHT_LIMITS.blockChars || countLines(code) > HIGHLIGHT_LIMITS.blockLines
  );
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
  cs: "csharp",
  "c#": "csharp",
  dotnet: "csharp",
  rb: "ruby",
  kt: "kotlin",
  kts: "kotlin",
  pl: "perl",
  ps1: "powershell",
  pwsh: "powershell",
  dockerfile: "docker",
  hs: "haskell",
  ex: "elixir",
  exs: "elixir",
  gql: "graphql",
  tf: "hcl",
  terraform: "hcl",
  proto: "protobuf",
  make: "makefile",
  mk: "makefile",
  objc: "objectivec",
  "objective-c": "objectivec",
  jl: "julia",
  clj: "clojure",
  ml: "ocaml",
  gradle: "groovy",
  sol: "solidity",
  tex: "latex",
  vimscript: "vim",
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
  csharp: "C#",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  scala: "Scala",
  dart: "Dart",
  lua: "Lua",
  perl: "Perl",
  r: "R",
  haskell: "Haskell",
  elixir: "Elixir",
  powershell: "PowerShell",
  docker: "Dockerfile",
  toml: "TOML",
  ini: "INI",
  graphql: "GraphQL",
  scss: "SCSS",
  less: "Less",
  makefile: "Makefile",
  objectivec: "Objective-C",
  protobuf: "Protobuf",
  hcl: "HCL",
  zig: "Zig",
  julia: "Julia",
  clojure: "Clojure",
  ocaml: "OCaml",
  groovy: "Groovy",
  nginx: "Nginx",
  http: "HTTP",
  solidity: "Solidity",
  vim: "Vim",
  latex: "LaTeX",
};

/** Canonical grammar for a fence label (`ts`, `TypeScript`, `language-ts`), or undefined. */
export function resolveHighlightLanguage(language: unknown): HighlightLanguage | undefined {
  if (typeof language !== "string" || language.length > 64) return undefined;

  const key = language
    .trim()
    .toLowerCase()
    .replace(/^language-/, "");

  if (!key) return undefined;
  if (own(GRAMMARS, key) || own(LAZY_GRAMMARS, key)) return key as HighlightLanguage;

  return own(ALIASES, key) ? ALIASES[key] : undefined;
}

/**
 * Human label for the header: "TypeScript" for `ts`, the fence's own label otherwise. An unknown
 * label is cut to a few safe characters, so a hostile fence cannot flood the header.
 */
export function codeLanguageLabel(language: unknown): string {
  const resolved = resolveHighlightLanguage(language);

  if (resolved && own(LABELS, resolved)) return LABELS[resolved];
  if (typeof language !== "string") return "Code";

  const raw = language
    .trim()
    .replace(/^language-/, "")
    .replace(/[^\w+#.-]/g, "")
    .slice(0, HIGHLIGHT_LIMITS.labelChars);

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

export type CodeLinesProps = {
  /** Source text without its trailing newline. */
  code: string;
  language?: string;
  showLineNumbers: boolean;
};

/**
 * One table row per source line: optional gutter number plus a `<code>` carrying the tokens.
 * Memoized on its three inputs so a settled block does not re-tokenize when a later markdown
 * block streams in.
 */
export const CodeLines = memo(function CodeLines({
  code,
  language,
  showLineNumbers,
}: CodeLinesProps) {
  const oversized = exceedsHighlightLimits(code);
  const grammar = useGrammar(oversized ? undefined : language);

  // Too large to tokenize or lay out line by line: one text node, no gutter, no tokens.
  if (oversized) return <CodePlain>{code}</CodePlain>;

  const sourceLines = code.split("\n");

  function renderLines(rows: HastNode[] | null) {
    return (
      <CodeTable>
        {sourceLines.map((line, index) => {
          const row = rows?.[index];

          return (
            <CodeRow key={index} newNo={index + 1} showNew={showLineNumbers} text={line}>
              {row?.children && line
                ? row.children.map((node, nodeIndex) =>
                    createElement({
                      node: node as never,
                      stylesheet: {},
                      useInlineStyles: false,
                      key: nodeIndex,
                    })
                  )
                : line}
            </CodeRow>
          );
        })}
      </CodeTable>
    );
  }

  if (!grammar) return renderLines(null);

  return (
    <HighlightBoundary key={code} fallback={renderLines(null)}>
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
    </HighlightBoundary>
  );
});

/**
 * A grammar that throws (a regex blowing the stack, a malformed chunk) must not take the message
 * down with it: fall back to the same text, uncolored.
 */
export class HighlightBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

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
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  dart: "dart",
  lua: "lua",
  pl: "perl",
  r: "r",
  hs: "haskell",
  ex: "elixir",
  exs: "elixir",
  ps1: "powershell",
  toml: "toml",
  ini: "ini",
  graphql: "graphql",
  gql: "graphql",
  scss: "scss",
  less: "less",
  mk: "makefile",
  m: "objectivec",
  mm: "objectivec",
  proto: "protobuf",
  tf: "hcl",
  hcl: "hcl",
  zig: "zig",
  jl: "julia",
  clj: "clojure",
  ml: "ocaml",
  groovy: "groovy",
  gradle: "groovy",
  sol: "solidity",
  vim: "vim",
  tex: "latex",
  http: "http",
  nginx: "nginx",
};

/** Extension-less files that still name a language. */
const BASENAMES: Record<string, string> = {
  dockerfile: "docker",
  makefile: "makefile",
  gnumakefile: "makefile",
};

/** Fence-style language for a file path (`lib/a.ts` → `typescript`), or undefined if unknown. */
export function languageForPath(path: unknown): string | undefined {
  if (typeof path !== "string") return undefined;

  // Paths come from a model; only the file name matters, and only its tail.
  const base = (path.slice(-300).split(/[\\/]/).pop() ?? "").toLowerCase();
  const named = own(BASENAMES, base) ? BASENAMES[base] : undefined;

  if (named) return named;

  const extension = base.includes(".") ? base.split(".").pop() : undefined;

  return extension && own(EXTENSIONS, extension) ? EXTENSIONS[extension] : undefined;
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
  const grammar = useGrammar(text.length > HIGHLIGHT_LIMITS.lineChars ? undefined : language);

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
    <HighlightBoundary key={text} fallback={render([{ text, className: "" }])}>
      <SyntaxHighlighter
        PreTag={Passthrough}
        CodeTag={Passthrough}
        language={grammar}
        renderer={({ rows }) => render(flattenTokens(rows as unknown as HastNode[]))}
        useInlineStyles={false}
      >
        {text}
      </SyntaxHighlighter>
    </HighlightBoundary>
  );
});

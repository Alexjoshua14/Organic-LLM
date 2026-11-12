"use client";

import type { CSSProperties } from "react";

import { memo, useEffect, useState } from "react";
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
export function resolveHighlightLanguage(
  language: string | undefined
): HighlightLanguage | undefined {
  const key = language
    ?.trim()
    .toLowerCase()
    .replace(/^language-/, "");

  if (!key) return undefined;
  if (key in GRAMMARS || key in LAZY_GRAMMARS) return key as HighlightLanguage;

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
  const grammar = useGrammar(language);
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
};

/** Extension-less files that still name a language. */
const BASENAMES: Record<string, string> = {
  dockerfile: "docker",
  makefile: "makefile",
  gnumakefile: "makefile",
};

/** Fence-style language for a file path (`lib/a.ts` → `typescript`), or undefined if unknown. */
export function languageForPath(path: string | undefined): string | undefined {
  const base = path?.split(/[\\/]/).pop() ?? "";
  const named = BASENAMES[base.toLowerCase()];

  if (named) return named;

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
  const grammar = useGrammar(language);

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

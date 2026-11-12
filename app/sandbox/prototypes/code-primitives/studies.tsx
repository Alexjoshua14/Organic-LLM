"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  FileCode2,
  GitCompareArrows,
  Maximize2,
  MessageSquareText,
  WrapText,
} from "lucide-react";
import Link from "next/link";

import styles from "./study.module.css";

const SOURCE = [
  'import { z } from "zod";',
  "",
  "const schema = z.object({",
  "  email: z.string().email(),",
  "});",
  "",
  "export async function subscribe(input: unknown) {",
  "  const { email } = schema.parse(input);",
  "",
  '  return fetch("/api/subscribe", {',
  '    method: "POST",',
  "    body: JSON.stringify({ email }),",
  "  });",
  "}",
];

const DIFF = [
  { old: 7, next: 7, text: "export async function subscribe(input: unknown) {" },
  { old: 8, text: "  const { email } = input as { email: string };", kind: "removed" },
  { next: 8, text: "  const { email } = schema.parse(input);", kind: "added" },
  { old: 9, next: 9, text: "" },
  { old: 10, next: 10, text: '  return fetch("/api/subscribe", {' },
  { old: 11, next: 11, text: '    method: "POST",' },
  { old: 12, next: 12, text: "    body: JSON.stringify({ email })," },
  { old: 13, next: 13, text: "  });" },
  { old: 14, next: 14, text: "}" },
];

const NOTES = [
  {
    title: "Define the contract",
    detail:
      "An email address is required. The schema checks its shape before it reaches the request.",
    lines: [3, 4, 5],
  },
  {
    title: "Validate at the boundary",
    detail:
      "Parsing turns unknown input into a validated value. Invalid input throws before fetch runs.",
    lines: [8],
  },
  {
    title: "Send the validated value",
    detail: "Only the parsed email is included in the request body.",
    lines: [10, 11, 12, 13],
  },
];

const MODES = [
  { id: "snippet", label: "Snippet", icon: Code2 },
  { id: "diff", label: "Review changes", icon: GitCompareArrows },
  { id: "explain", label: "Explain", icon: MessageSquareText },
] as const;

type Mode = (typeof MODES)[number]["id"];

// A small, fixed TypeScript sample; this study does not replace the production highlighter.
function Syntax({ text }: { text: string }) {
  const tokens = text.split(
    /("[^"\n]*"|\b(?:import|from|const|export|async|function|return|as)\b|\b(?:unknown|string)\b|\b\w+(?=\())/g
  );

  return tokens.map((token, index) => {
    const kind = token.startsWith('"')
      ? "string"
      : /^(import|from|const|export|async|function|return|as)$/.test(token)
        ? "keyword"
        : /^(unknown|string)$/.test(token)
          ? "type"
          : /^\w+$/.test(token)
            ? "function"
            : undefined;

    return (
      <span key={index} data-token={kind}>
        {token}
      </span>
    );
  });
}

export function CodeStudies() {
  const [mode, setMode] = useState<Mode>("diff");
  const [wrap, setWrap] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState<number | null>(1);
  const [copyState, setCopyState] = useState("Copy");
  const [view, setView] = useState<"changes" | "result">("changes");
  const [context, setContext] = useState(false);
  const [selection, setSelection] = useState<number | null>(null);
  const showDiff = mode === "diff" && view === "changes";
  const activeNote = note === null ? null : NOTES[note];

  function selectMode(next: Mode) {
    setMode(next);
    setCopyState("Copy");
    setOpen(true);
    setSelection(null);
  }

  async function copy() {
    const text = showDiff
      ? [
          "--- a/lib/subscribe.ts",
          "+++ b/lib/subscribe.ts",
          "@@ -7,8 +7,8 @@",
          ...DIFF.map(
            (line) =>
              `${line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}${line.text}`
          ),
        ].join("\n")
      : SOURCE.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyState("Copied");
    } catch {
      setCopyState("Copy failed");
    }
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.page} data-expanded={expanded}>
        <header className={styles.pageHeader}>
          <Link href="/sandbox/prototypes/gen-ui-lab" className={styles.back}>
            <ArrowLeft size={14} /> Gen UI Lab
          </Link>
          <span className={styles.studyTag}>Design study · second pass</span>
        </header>
        <div className={styles.intro}>
          <h1>Code primitives</h1>
          <p>Read the code. See the change. Follow the reasoning.</p>
        </div>
        <div className={styles.modes} aria-label="Code primitive">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => selectMode(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <main className={styles.stage} data-mode={mode}>
          <div className={styles.context}>
            <span className={styles.responseLabel}>
              <span className={styles.presence} />
              Organic<span className={styles.responseDivider}>/</span>
              {mode === "diff"
                ? "Suggested change"
                : mode === "explain"
                  ? "A closer look"
                  : "Ready to use"}
            </span>
            <h2>
              {mode === "diff"
                ? "Give unknown input a real boundary."
                : mode === "explain"
                  ? "From unknown input to a trusted value."
                  : "A small handler. An explicit contract."}
            </h2>
            <p>
              {mode === "diff"
                ? "A type assertion only changes what TypeScript believes. Parse the input before it leaves your application."
                : mode === "explain"
                  ? "Three decisions, each connected to the code that makes it work."
                  : "Validate the email, then send exactly what the endpoint needs."}
            </p>
          </div>

          <div className={styles.readingLayout} data-annotated={mode === "explain"}>
            <div className={styles.codePanel}>
              <div className={styles.fileHeader}>
                <button
                  className={styles.fileToggle}
                  type="button"
                  onClick={() => setOpen(!open)}
                  aria-expanded={open}
                  aria-controls="study-code"
                >
                  <ChevronDown size={13} className={open ? undefined : styles.closed} />
                  <span className={styles.fileIcon}>
                    <FileCode2 size={16} />
                  </span>
                  <span className={styles.fileIdentity}>
                    <strong>subscribe.ts</strong>
                    <span>lib</span>
                  </span>
                </button>
                <div className={styles.actions}>
                  <button
                    type="button"
                    aria-label="Wrap lines"
                    title="Wrap lines"
                    aria-pressed={wrap}
                    onClick={() => setWrap(!wrap)}
                  >
                    <WrapText size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={expanded ? "Restore width" : "Expand width"}
                    title={expanded ? "Restore width" : "Expand width"}
                    aria-pressed={expanded}
                    onClick={() => setExpanded(!expanded)}
                  >
                    <Maximize2 size={14} />
                  </button>
                  <span className={styles.actionDivider} />
                  <button className={styles.copy} type="button" onClick={copy}>
                    {copyState === "Copied" ? <Check size={14} /> : <Copy size={14} />}
                    <span aria-live="polite">
                      {copyState === "Copy" ? (showDiff ? "Copy patch" : "Copy code") : copyState}
                    </span>
                  </button>
                </div>
              </div>

              {open && (
                <div id="study-code" className={styles.codeBody} data-wrap={wrap}>
                  <div className={styles.codeToolbar}>
                    {mode === "diff" ? (
                      <div className={styles.viewSwitch} aria-label="Diff view">
                        <button
                          type="button"
                          aria-pressed={view === "changes"}
                          onClick={() => {
                            setView("changes");
                            setCopyState("Copy");
                          }}
                        >
                          Changes
                        </button>
                        <button
                          type="button"
                          aria-pressed={view === "result"}
                          onClick={() => {
                            setView("result");
                            setCopyState("Copy");
                          }}
                        >
                          Result
                        </button>
                      </div>
                    ) : (
                      <span className={styles.language}>
                        TypeScript<span className={styles.toolbarDot}>·</span>14 lines
                      </span>
                    )}
                    {mode === "diff" ? (
                      <span className={styles.counts}>
                        <span>+1</span>
                        <span>−1</span>
                        <span className={styles.changeWord}>line changed</span>
                      </span>
                    ) : mode === "explain" ? (
                      <button
                        className={styles.resetFocus}
                        type="button"
                        onClick={() => {
                          setNote(null);
                          setSelection(null);
                        }}
                      >
                        Show all lines
                      </button>
                    ) : (
                      <span className={styles.language}>Source</span>
                    )}
                  </div>
                  {showDiff ? (
                    <>
                      <div className={styles.hunk}>
                        <span>07—14</span>
                        <span>subscribe(input)</span>
                      </div>
                      <div className={styles.lines}>
                        {DIFF.filter((_, index) => context || index < 4 || index === 8).map(
                          (line, index) => (
                            <div
                              key={`${line.old}-${line.next}`}
                              className={styles.diffLine}
                              data-kind={line.kind}
                            >
                              <span className={styles.number} aria-hidden>
                                {line.old}
                              </span>
                              <span className={styles.number} aria-hidden>
                                {line.next}
                              </span>
                              <span className={styles.sign} aria-label={line.kind}>
                                {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : ""}
                              </span>
                              <code>
                                {line.kind ? (
                                  <>
                                    {"  const { email } = "}
                                    <mark>
                                      <Syntax
                                        text={
                                          line.kind === "added"
                                            ? "schema.parse(input)"
                                            : "input as { email: string }"
                                        }
                                      />
                                    </mark>
                                    ;
                                  </>
                                ) : (
                                  <Syntax text={line.text} />
                                )}
                              </code>
                              {!context && index === 3 && (
                                <button
                                  type="button"
                                  className={styles.foldContext}
                                  onClick={() => setContext(true)}
                                >
                                  <ChevronDown size={12} />
                                  Show 4 unchanged lines<span>10—13</span>
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>
                      {context && (
                        <button
                          type="button"
                          className={styles.hideContext}
                          onClick={() => setContext(false)}
                        >
                          Hide unchanged request
                        </button>
                      )}
                    </>
                  ) : (
                    <div className={styles.lines}>
                      {SOURCE.map((line, index) => (
                        <div
                          key={index}
                          className={styles.sourceLine}
                          data-selected={selection === index + 1}
                          data-focus={
                            mode === "explain" && activeNote
                              ? activeNote.lines.includes(index + 1)
                                ? "active"
                                : "dimmed"
                              : undefined
                          }
                        >
                          <button
                            className={styles.lineNumber}
                            type="button"
                            aria-label={`Select line ${index + 1}`}
                            aria-pressed={selection === index + 1}
                            onClick={() => {
                              setSelection(selection === index + 1 ? null : index + 1);
                              if (mode === "explain") {
                                const match = NOTES.findIndex((item) =>
                                  item.lines.includes(index + 1)
                                );

                                setNote(match < 0 ? null : match);
                              }
                            }}
                          >
                            {index + 1}
                          </button>
                          <code>
                            <Syntax text={line} />
                          </code>
                          {mode === "explain" &&
                            NOTES.some((item) => item.lines[0] === index + 1) && (
                              <span className={styles.anchorMark} aria-hidden>
                                {NOTES.findIndex((item) => item.lines[0] === index + 1) + 1}
                              </span>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={styles.footer}>
                    <span>
                      {selection
                        ? `Line ${selection} selected`
                        : showDiff
                          ? context
                            ? "Full change context"
                            : "Unchanged request folded"
                          : "UTF-8"}
                    </span>
                    <span>{showDiff ? "Unified diff" : "TypeScript"}</span>
                  </div>
                </div>
              )}
            </div>

            {mode === "explain" && (
              <aside className={styles.explanation} aria-label="Code walkthrough">
                <span className={styles.railLabel}>Follow the flow</span>
                {NOTES.map((item, index) => (
                  <button
                    className={styles.step}
                    key={item.title}
                    type="button"
                    aria-pressed={note === index}
                    onClick={() => {
                      setNote(note === index ? null : index);
                      setSelection(null);
                      setOpen(true);
                    }}
                  >
                    <span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.stepContent}>
                      <span className={styles.stepTitle}>
                        {item.title}
                        <span className={styles.lineRange}>
                          L{item.lines[0]}
                          {item.lines.length > 1 ? `–${item.lines.at(-1)}` : ""}
                        </span>
                      </span>
                      <span className={styles.stepDetail}>{item.detail}</span>
                    </span>
                  </button>
                ))}
                <span className={styles.railFoot}>Select a step or a line number.</span>
              </aside>
            )}
          </div>

          {mode === "diff" && (
            <div className={styles.changeReason}>
              <span className={styles.reasonIcon}>
                <GitCompareArrows size={15} />
              </span>
              <div>
                <span className={styles.reasonLabel}>Why this change</span>
                <p>
                  The check now happens at runtime.
                  <br />
                  <span>Malformed input stops here, before the network request.</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    selectMode("explain");
                    setNote(1);
                  }}
                >
                  Walk through the code
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          )}
        </main>

        <footer className={styles.references}>
          <span>
            {mode === "diff"
              ? "A change you can read at a glance."
              : mode === "snippet"
                ? "The code gets the space. Controls stay quiet."
                : "Reasoning and implementation, in the same place."}
          </span>
          <a
            href={
              mode === "diff"
                ? "https://diffs.com/"
                : mode === "snippet"
                  ? "https://vercel.com/geist/code-block"
                  : "https://codehike.org/docs/code/focus"
            }
            target="_blank"
            rel="noreferrer"
          >
            {mode === "diff"
              ? "Pierre reference"
              : mode === "snippet"
                ? "Geist reference"
                : "Code Hike reference"}
            <ArrowUpRight size={13} />
          </a>
        </footer>
      </div>
    </div>
  );
}

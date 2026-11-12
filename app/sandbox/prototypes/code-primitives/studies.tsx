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
  const [wrap, setWrap] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState<number | null>(1);
  const [copyState, setCopyState] = useState("Copy");

  async function copy() {
    const text =
      mode === "diff"
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
          <span className={styles.studyTag}>Design study · interactive</span>
        </header>
        <div className={styles.intro}>
          <h1>Code primitives</h1>
          <p>One visual language. Three ways to read code.</p>
        </div>
        <div className={styles.modes} aria-label="Code primitive">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => {
                setMode(id);
                setCopyState("Copy");
                setOpen(true);
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <main className={styles.stage}>
          <div className={styles.context}>
            <span className={styles.responseLabel}>Organic</span>
            <h2>
              {mode === "diff"
                ? "Validate before making the request."
                : mode === "explain"
                  ? "Here’s how the validation works."
                  : "A small, typed subscription handler."}
            </h2>
            <p>
              {mode === "diff"
                ? "Replace the type assertion with a runtime check. Invalid input will fail before the request is sent."
                : mode === "explain"
                  ? "Choose a step to bring the relevant code into focus."
                  : "The schema checks the email address, then sends the validated value to your endpoint."}
            </p>
          </div>

          <div className={styles.codePanel}>
            <div className={styles.fileHeader}>
              <button
                className={styles.fileToggle}
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="study-code"
              >
                <ChevronDown size={14} className={open ? undefined : styles.closed} />
                <FileCode2 size={16} />
                <span className={styles.path}>
                  lib/<strong>subscribe.ts</strong>
                </span>
              </button>
              {mode === "diff" ? (
                <span className={styles.counts}>
                  <span>+1</span>
                  <span>−1</span>
                </span>
              ) : (
                <span className={styles.language}>TypeScript</span>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  aria-label="Wrap lines"
                  aria-pressed={wrap}
                  onClick={() => setWrap(!wrap)}
                >
                  <WrapText size={15} />
                </button>
                <button
                  type="button"
                  aria-label={expanded ? "Restore width" : "Expand width"}
                  aria-pressed={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  <Maximize2 size={14} />
                </button>
                <button className={styles.copy} type="button" onClick={copy}>
                  {copyState === "Copied" ? <Check size={14} /> : <Copy size={14} />}
                  <span aria-live="polite">
                    {copyState === "Copy" && mode === "diff" ? "Copy patch" : copyState}
                  </span>
                </button>
              </div>
            </div>

            {open && (
              <div id="study-code" className={styles.codeBody} data-wrap={wrap}>
                {mode === "diff" ? (
                  <>
                    <div className={styles.hunk}>
                      <span>@@ 7–14</span>
                      <span>subscribe</span>
                      <span className={styles.hunkLabel}>Validate input</span>
                    </div>
                    <div className={styles.lines}>
                      {DIFF.map((line, index) => (
                        <div key={index} className={styles.diffLine} data-kind={line.kind}>
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
                        </div>
                      ))}
                    </div>
                    <div className={styles.reviewNote}>
                      <span className={styles.noteDot} />
                      <div>
                        <strong>A type assertion doesn’t validate at runtime.</strong>
                        <p>
                          <code>schema.parse</code> checks the value and gives the rest of the
                          function a typed email.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.lines}>
                    {SOURCE.map((line, index) => (
                      <div
                        key={index}
                        className={styles.sourceLine}
                        data-focus={
                          mode === "explain" && note !== null
                            ? NOTES[note].lines.includes(index + 1)
                              ? "active"
                              : "dimmed"
                            : undefined
                        }
                      >
                        <span className={styles.number} aria-hidden>
                          {index + 1}
                        </span>
                        <code>
                          <Syntax text={line} />
                        </code>
                        {mode === "explain" && index === 7 && (
                          <span className={styles.lineLabel}>validate</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.footer}>
                  <span>{mode === "diff" ? "1 file changed" : "14 lines"}</span>
                  <span>{mode === "diff" ? "Unified diff" : "TypeScript"}</span>
                </div>
              </div>
            )}
          </div>

          {mode === "explain" && (
            <div className={styles.explanation}>
              <div className={styles.stepList}>
                {NOTES.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    aria-pressed={note === index}
                    onClick={() => setNote(note === index ? null : index)}
                  >
                    <span>{index + 1}</span>
                    {item.title}
                  </button>
                ))}
              </div>
              <p aria-live="polite">
                {note === null
                  ? "All code is visible. Select a step to focus."
                  : NOTES[note].detail}
              </p>
            </div>
          )}
        </main>

        <footer className={styles.references}>
          <span>
            {mode === "diff"
              ? "Precise changes · quiet context · attached reasoning"
              : mode === "snippet"
                ? "Readable source · stable controls · clean copy"
                : "Connected explanation · selective focus · full context"}
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

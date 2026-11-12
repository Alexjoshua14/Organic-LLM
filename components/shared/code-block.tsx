"use client";

import { Check, Copy, FileCode2, TriangleAlert, WrapText } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import styles from "./code-block.module.css";
import { CodeLines, codeLanguageLabel, resolveHighlightLanguage } from "./code-highlight";

import { fontMono } from "@/config/fonts";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { cn } from "@/lib/utils";

export type CodeBlockProps = ComponentPropsWithoutRef<"pre"> & {
  /** When true, fenced code starts wrapped instead of expanding width / scrolling horizontally. */
  wrap?: boolean;
  /** Applied to the outer wrapper (e.g. spacing in article body). */
  containerClassName?: string;
};

/** Blocks at or above this many lines get a line-number gutter; short snippets stay clean. */
const LINE_NUMBER_THRESHOLD = 5;
const COPY_FEEDBACK_MS = 2000;
/**
 * Tokenizing costs roughly 0.05 ms per line (about 23 ms for 400 lines, measured), and the last
 * block of a streaming reply re-renders on every token. Up to this many lines highlight
 * immediately; longer blocks show plain text while they change and are colored once the text
 * has been still for HIGHLIGHT_SETTLE_MS. A block that mounts already complete highlights at once.
 */
const HIGHLIGHT_EAGER_LINES = 60;
const HIGHLIGHT_SETTLE_MS = 150;

type ExtractedCode = { text: string; language: string | undefined };

/**
 * Reads the source and fence language from `<pre><code className="language-x">text</code></pre>`
 * (react-markdown, blog and rabbit-hole all hand us that shape). Returns null when the child is
 * anything else, e.g. already-tokenized spans, so the caller falls back to rendering it as is.
 */
function extractCode(children: ReactNode): ExtractedCode | null {
  const only = Children.toArray(children);
  const child = only.length === 1 ? only[0] : null;

  if (!isValidElement<{ className?: unknown; children?: ReactNode }>(child)) return null;

  const { className, children: inner } = child.props;
  const parts = Children.toArray(inner);

  if (!parts.every((part) => typeof part === "string" || typeof part === "number")) return null;

  const language =
    typeof className === "string"
      ? className
          .split(/\s+/)
          .find((name) => name.startsWith("language-"))
          ?.slice("language-".length)
      : undefined;

  return { text: parts.join("").replace(/\n$/, ""), language };
}

type CopyState = "idle" | "copied" | "failed";

/**
 * Default fenced code block: a quiet header (language, line count, wrap, copy) over
 * syntax-highlighted lines. Used by chat markdown, gen-ui markdown, blog prose and the
 * rabbit-hole article. Mermaid fences keep their diagram with no code chrome.
 */
export function CodeBlock({
  wrap = false,
  containerClassName,
  children,
  className,
}: CodeBlockProps) {
  const extracted = extractCode(children);
  const [wrapped, setWrapped] = useState(wrap);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawCode = extracted?.text ?? "";
  const [settledCode, setSettledCode] = useState(rawCode);

  useEffect(() => {
    if (settledCode === rawCode) return;
    const settle = setTimeout(() => setSettledCode(rawCode), HIGHLIGHT_SETTLE_MS);

    return () => clearTimeout(settle);
  }, [rawCode, settledCode]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const handleCopy = useCallback(async () => {
    const text = extracted?.text ?? "";

    if (!text) return;

    const ok = await copyTextToClipboard(text);

    setCopyState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
  }, [extracted?.text]);

  if (extracted?.language === "mermaid") {
    return <div className={cn(styles.plain, containerClassName)}>{children}</div>;
  }

  const lineCount = rawCode ? rawCode.split("\n").length : 0;
  const label = codeLanguageLabel(extracted?.language);
  const settling = lineCount > HIGHLIGHT_EAGER_LINES && settledCode !== rawCode;
  const highlightLanguage = settling ? undefined : extracted?.language;
  const highlighted = resolveHighlightLanguage(highlightLanguage) !== undefined;

  return (
    <div
      className={cn(
        styles.root,
        "organic-code not-prose",
        fontMono.variable,
        className,
        containerClassName
      )}
      data-wrap={wrapped}
      data-highlighted={highlighted}
    >
      <div className={styles.header}>
        <span className={styles.identity}>
          <FileCode2 size={14} aria-hidden />
          <span className={styles.language}>{label}</span>
          {lineCount > 1 && <span className={styles.meta}>· {lineCount} lines</span>}
        </span>
        <div className={styles.actions}>
          <button
            aria-label="Wrap lines"
            aria-pressed={wrapped}
            className={cn(styles.action, "organic-focus")}
            title="Wrap lines"
            type="button"
            onClick={() => setWrapped((value) => !value)}
          >
            <WrapText size={15} aria-hidden />
          </button>
          <span className={styles.divider} aria-hidden />
          <button
            className={cn(styles.action, styles.copy, "organic-focus")}
            disabled={!extracted}
            type="button"
            onClick={handleCopy}
          >
            {copyState === "copied" ? (
              <Check size={14} aria-hidden />
            ) : copyState === "failed" ? (
              <TriangleAlert size={14} aria-hidden />
            ) : (
              <Copy size={14} aria-hidden />
            )}
            <span aria-live="polite">
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy code"}
            </span>
          </button>
        </div>
      </div>
      <div className={styles.body}>
        {extracted ? (
          <CodeLines
            code={rawCode}
            language={highlightLanguage}
            showLineNumbers={lineCount >= LINE_NUMBER_THRESHOLD}
          />
        ) : (
          <pre className={styles.fallback}>{children}</pre>
        )}
      </div>
    </div>
  );
}

export type CodeInlineProps = ComponentPropsWithoutRef<"code"> & {
  /** True when this <code> is inside a fenced block (child of <pre>). */
  inBlockCode?: boolean;
  /** When true with inBlockCode, allow wrapping (e.g. composer preview). */
  wrap?: boolean;
};

/**
 * Inline code chip, sized in `em` so it scales with surrounding text (chat body, gen-ui cards).
 * `before`/`after:content-none` drop the literal backticks Tailwind Typography's `prose` adds
 * around `code`; weight inherits so `**`code`**` reads bold and plain code does not.
 * These utilities beat the `prose` code rules on source order (same layer, same specificity).
 */
export const INLINE_CODE_CHIP_CLASS =
  "rounded-[0.3em] bg-muted/70 px-[0.35em] py-[0.1em] font-mono text-[0.875em] [font-weight:inherit] box-decoration-clone before:content-none after:content-none";

/**
 * Inline or fenced-inner <code> styling. Does not handle mermaid — that stays in chat.
 */
export function CodeInline({
  inBlockCode = false,
  wrap = false,
  className,
  ...props
}: CodeInlineProps) {
  return (
    <code
      className={cn(
        !inBlockCode && "max-w-full break-words overflow-x-auto",
        !inBlockCode && INLINE_CODE_CHIP_CLASS,
        inBlockCode && wrap && "min-w-0 [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  );
}

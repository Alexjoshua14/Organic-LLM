"use client";

import type { ReactNode } from "react";

import { Check, Copy, TriangleAlert, WrapText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./code.module.css";

import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { cn } from "@/lib/utils";

const COPY_FEEDBACK_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

type CodeCopyButtonProps = {
  /** Exactly what lands on the clipboard: the source, or the diff as supplied. */
  text: string;
  /** Idle label: "Copy code", "Copy diff". */
  label?: string;
  /** Accessible name while idle, when the label alone is ambiguous: "Copy diff of lib/x.ts". */
  ariaLabel?: string;
  /** What assistive tech hears when the copy finishes. */
  announce?: { copied: string; failed: string };
  disabled?: boolean;
};

const DEFAULT_ANNOUNCE = { copied: "Code copied", failed: "Could not copy the code" };

/**
 * Copy control with a reserved width, so Copy / Copied / Copy failed never shift the toolbar.
 * The label is a live region.
 */
export function CodeCopyButton({
  text,
  label = "Copy code",
  ariaLabel,
  announce = DEFAULT_ANNOUNCE,
  disabled = false,
}: CodeCopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(async () => {
    if (!text) return;

    const ok = await copyTextToClipboard(text);

    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), COPY_FEEDBACK_MS);
  }, [text]);

  return (
    <>
      <button
        aria-label={state === "idle" ? ariaLabel : undefined}
        className={cn(styles.action, styles.copy, "organic-focus")}
        disabled={disabled}
        type="button"
        onClick={() => void copy()}
      >
        {state === "copied" ? (
          <Check size={14} aria-hidden />
        ) : state === "failed" ? (
          <TriangleAlert size={14} aria-hidden />
        ) : (
          <Copy size={14} aria-hidden />
        )}
        <span className={styles.copyLabel}>
          {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
        </span>
      </button>
      <span aria-live="polite" className={styles.srOnly} role="status">
        {state === "copied" ? announce.copied : state === "failed" ? announce.failed : ""}
      </span>
    </>
  );
}

type CodeWrapButtonProps = {
  pressed: boolean;
  onToggle: () => void;
  /** An icon button in a code header, or a text button in a toolbar. */
  variant?: "icon" | "text";
};

export function CodeWrapButton({ pressed, onToggle, variant = "icon" }: CodeWrapButtonProps) {
  return (
    <button
      aria-label={variant === "icon" ? "Wrap lines" : undefined}
      aria-pressed={pressed}
      className={cn(styles.action, "organic-focus")}
      title="Wrap lines"
      type="button"
      onClick={onToggle}
    >
      <WrapText size={15} aria-hidden />
      {variant === "text" ? <span>Wrap lines</span> : null}
    </button>
  );
}

/** The row of header actions, right-aligned by its parent. */
export function CodeActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function CodeActionDivider() {
  return <span aria-hidden className={styles.divider} />;
}

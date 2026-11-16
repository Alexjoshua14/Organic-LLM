"use client";

import type { MouseEvent, ReactNode } from "react";

import { Check, ChevronDown, Copy, Maximize2, TriangleAlert, WrapText } from "lucide-react";
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
  /** Keep the text label on a phone, where the icon alone is the default (a roomy toolbar). */
  showLabel?: boolean;
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
  showLabel = false,
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
        data-labelled={showLabel ? "" : undefined}
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
  /** Leave it out of an inline phone header: the reader owns wrapping there. */
  wideOnly?: boolean;
  className?: string;
};

export function CodeWrapButton({
  pressed,
  onToggle,
  variant = "icon",
  wideOnly = false,
  className,
}: CodeWrapButtonProps) {
  return (
    <button
      aria-label={variant === "icon" ? "Wrap lines" : undefined}
      aria-pressed={pressed}
      className={cn(styles.action, wideOnly && styles.wideOnly, "organic-focus", className)}
      title="Wrap lines"
      type="button"
      onClick={onToggle}
    >
      <WrapText size={15} aria-hidden />
      {variant === "text" ? <span>Wrap lines</span> : null}
    </button>
  );
}

/** Opens the reader. Phones only: a wide screen already shows the whole block. */
export function CodeExpandButton({
  onClick,
  label,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn(styles.action, styles.phoneOnly, "organic-focus")}
      title={label}
      type="button"
      onClick={onClick}
    >
      <Maximize2 size={14} aria-hidden />
    </button>
  );
}

/** The foot of a capped glance: how much is hidden, and the way to read it. Phones only. */
export function CodeShowAllButton({
  onClick,
  children,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      className={cn(styles.action, styles.more, styles.phoneOnly, "organic-focus")}
      type="button"
      onClick={onClick}
    >
      {children}
      <ChevronDown size={14} aria-hidden />
    </button>
  );
}

/** The row of header actions, right-aligned by its parent. */
export function CodeActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

/** `wideOnly`: drop it on a phone, where it would sit beside only one control. */
export function CodeActionDivider({ wideOnly = false }: { wideOnly?: boolean }) {
  return <span aria-hidden className={cn(styles.divider, wideOnly && styles.wideOnly)} />;
}

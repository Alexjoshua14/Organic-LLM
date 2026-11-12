"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./Diff.module.css";

type DiffCopyButtonProps = {
  /** The diff exactly as supplied, not the shortened display text. */
  text: string;
  /** Names the file for assistive tech: "Copy diff of lib/x.ts". */
  path: string;
};

type CopyState = "idle" | "copied" | "failed";

const RESET_MS = 2_000;

export function DiffCopyButton({ text, path }: DiffCopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copy() {
    let next: CopyState = "copied";

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard API, or permission refused.
      next = "failed";
    }

    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), RESET_MS);
  }

  const label = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy diff";

  return (
    <>
      <button
        aria-label={state === "idle" ? `Copy diff of ${path}` : undefined}
        className={styles.btn}
        type="button"
        onClick={() => void copy()}
      >
        {label}
      </button>
      <span aria-live="polite" className={styles.srOnly} role="status">
        {state === "copied" ? "Diff copied" : state === "failed" ? "Could not copy the diff" : ""}
      </span>
    </>
  );
}

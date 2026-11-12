"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CodeWrapButton } from "./code-actions";
import styles from "./code-reader.module.css";
import { CodeScroll, CodeSurface } from "./code-surface";

import { fontMono } from "@/config/fonts";
import { cn } from "@/lib/utils";

/** Reader text sizes in px. The middle step is the default; the choice is remembered. */
export const CODE_READER_SIZES = [11, 12, 13, 14, 16, 18] as const;
const DEFAULT_SIZE_INDEX = 2;
const SIZE_STORAGE_KEY = "organic.code-reader.size";

function readStoredSizeIndex() {
  try {
    const raw = window.localStorage.getItem(SIZE_STORAGE_KEY);
    const stored = raw === null ? Number.NaN : Number(raw);

    return Number.isInteger(stored) && stored >= 0 && stored < CODE_READER_SIZES.length
      ? stored
      : DEFAULT_SIZE_INDEX;
  } catch {
    return DEFAULT_SIZE_INDEX;
  }
}

function storeSizeIndex(index: number) {
  try {
    window.localStorage.setItem(SIZE_STORAGE_KEY, String(index));
  } catch {
    // Private windows and blocked storage: the size just is not remembered.
  }
}

/**
 * Makes the back gesture (and the browser's Back) close the reader instead of leaving the page.
 * The history entry has its own state key, so it never collides with the diagram takeover's.
 * A reader closed by its own button pops the entry it pushed; one closed by navigating away
 * leaves history alone (the entry on top is no longer ours).
 */
/** History pops the reader started itself (see `useBackToClose`): they must not close the next one. */
let selfPops = 0;

function popOwnEntry() {
  selfPops += 1;
  // Count it down after the event has reached every listener, so a reader opened in between
  // (before the pop lands) still ignores it.
  window.addEventListener("popstate", () => setTimeout(() => (selfPops -= 1), 0), { once: true });
  window.history.back();
}

function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    let pushed = true;

    window.history.pushState({ ...window.history.state, codeReader: true }, "");

    const onPop = () => {
      if (!pushed || selfPops > 0) return;
      pushed = false;
      closeRef.current();
    };

    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (pushed && window.history.state?.codeReader) popOwnEntry();
    };
  }, [open]);
}

/**
 * Open state for a reader, plus the control that opened it. Radix only returns focus to a Trigger,
 * and Safari on iOS does not focus a button on tap, so the opener is remembered from the click.
 */
export function useCodeReader() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const show = useCallback((event: { currentTarget: HTMLElement }) => {
    opener.current = event.currentTarget;
    setOpen(true);
  }, []);

  return { open, setOpen, show, opener };
}

type CodeReaderProps = {
  open: boolean;
  /** From `useCodeReader`: where focus goes back to on close. */
  opener?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  /** "TypeScript", or a file path. */
  title: string;
  /** Quiet second line of the title: "124 lines", "+12 −3". */
  meta?: string;
  /** Names the scroll region, e.g. "TypeScript code". */
  label: string;
  /** Digits in the widest line number; sizes the gutters. */
  digits: number;
  /** A `CodeCopyButton` (pass `showLabel`): what is copied differs between a block and a diff. */
  copy?: ReactNode;
  /** The line table, given as the live content so a streaming block keeps growing in here. */
  children: ReactNode;
};

/**
 * The full-screen reader a phone opens from a code block or a diff file. The inline version is a
 * glance (no gutter, capped); this is where a long block is read: line numbers, sideways scrolling
 * or wrapping, and a text size the reader chooses. Controls sit at the bottom, within thumb reach;
 * Close is at the top, labelled. Escape and the back gesture close it, and focus returns to the
 * control that opened it. It portals to the body so a clipped chat column cannot trap it.
 */
export function CodeReader({
  open,
  opener,
  onOpenChange,
  title,
  meta,
  label,
  digits,
  copy,
  children,
}: CodeReaderProps) {
  const [wrapped, setWrapped] = useState(false);
  const [sizeIndex, setSizeIndex] = useState(readStoredSizeIndex);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useBackToClose(open, close);

  function step(delta: number) {
    const next = Math.min(CODE_READER_SIZES.length - 1, Math.max(0, sizeIndex + delta));

    setSizeIndex(next);
    storeSizeIndex(next);
  }

  const size = CODE_READER_SIZES[sizeIndex];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          // Focus the sheet, not Close: a focus mark on the first control looks like a stuck state.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener?.current?.focus();
          }}
          className={cn(styles.sheet, "organic-code not-prose", fontMono.variable)}
          style={{ "--reader-size": `${size}px` } as CSSProperties}
        >
          <header className={styles.head}>
            <Dialog.Title className={styles.title}>
              <span className={styles.name}>{title}</span>
              {meta ? <span className={styles.meta}>{meta}</span> : null}
            </Dialog.Title>
            <Dialog.Close className={cn(styles.close, "organic-focus")}>
              <X size={16} aria-hidden />
              Close
            </Dialog.Close>
          </header>

          <div className={styles.body}>
            <CodeSurface data-reader="true" wrap={wrapped}>
              <CodeScroll digits={digits} focusable={!wrapped} label={label}>
                {children}
              </CodeScroll>
            </CodeSurface>
          </div>

          <div className={styles.bar} role="toolbar" aria-label="Reader controls">
            <CodeWrapButton
              className={styles.tool}
              pressed={wrapped}
              variant="text"
              onToggle={() => setWrapped((value) => !value)}
            />
            <div className={styles.sizes}>
              <button
                aria-label="Smaller text"
                className={cn(styles.tool, styles.sizeButton, "organic-focus")}
                disabled={sizeIndex === 0}
                type="button"
                onClick={() => step(-1)}
              >
                <span aria-hidden className={styles.small}>
                  A
                </span>
              </button>
              <button
                aria-label="Larger text"
                className={cn(styles.tool, styles.sizeButton, "organic-focus")}
                disabled={sizeIndex === CODE_READER_SIZES.length - 1}
                type="button"
                onClick={() => step(1)}
              >
                <span aria-hidden className={styles.large}>
                  A
                </span>
              </button>
            </div>
            {copy}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

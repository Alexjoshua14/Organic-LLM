"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useCallback, useRef, useState, type ComponentPropsWithoutRef } from "react";

import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

export type CodeBlockProps = ComponentPropsWithoutRef<"pre"> & {
  /** When true, fenced code wraps instead of expanding width / scrolling horizontally. */
  wrap?: boolean;
  /** Applied to the outer wrapper (e.g. spacing in article body). */
  containerClassName?: string;
};

/**
 * Fenced code block: rounded container, optional horizontal scroll, copy button.
 * Used by Chat markdown and Rabbit Hole article HTML upgrades.
 */
export function CodeBlock({
  wrap = false,
  containerClassName,
  children,
  className,
  ...preProps
}: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const el = preRef.current;
    const code = el?.querySelector("code")?.textContent ?? el?.textContent ?? "";

    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div
      className={cn(
        "relative group/codeblock max-w-full min-w-0 rounded-lg transition-shadow duration-200 group-hover/codeblock:shadow-[0_0_20px_-4px_hsl(var(--border)),0_0_0_1px_hsl(var(--border)/0.5)]",
        wrap ? "overflow-x-hidden" : "overflow-x-auto",
        containerClassName
      )}
    >
      <pre
        ref={preRef}
        className={cn(
          "min-w-0 max-w-full",
          wrap
            ? "overflow-x-hidden whitespace-pre-wrap wrap-break-word pr-10 [&_code]:min-w-0 [&_code]:wrap-anywhere"
            : "overflow-x-auto",
          className
        )}
        {...preProps}
      >
        {children}
      </pre>
      <Button
        aria-label={isCopied ? "Copied" : "Copy code"}
        className={cn(
          "absolute top-2 right-2 h-8 w-8 shrink-0 opacity-0 transition-opacity",
          "group-hover/codeblock:opacity-100 focus:opacity-100",
          "hover:bg-secondary/95! hover:from-secondary/95! hover:to-[#e8e6e1]! dark:hover:from-[#252625]! dark:hover:to-[#1e1f1e]!"
        )}
        size="icon"
        type="button"
        variant="secondaryInteractive"
        onClick={handleCopy}
      >
        {isCopied ? (
          <CheckIcon className="h-4 w-4 text-green-600" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
      </Button>
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
        inBlockCode && wrap && "min-w-0 [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  );
}

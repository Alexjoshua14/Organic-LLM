"use client";

import { memo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { chatMarkdownCodeComponents } from "@/components/chat/chat-message-markdown";
import { cn } from "@/lib/utils";

/**
 * Markdown for model-written text inside gen-ui blocks (answer cards, plans, recipes, …).
 *
 * Blocks render under `not-prose`, so chat's typography styles don't reach them; each element
 * gets a small explicit style here instead. Code reuses chat's renderers so inline code is the
 * same chip and fenced code keeps its copy button.
 *
 * - `inline`: one-line fields (summaries, key points, notes). Only inline marks survive
 *   (bold, italic, strike, code, links); paragraphs unwrap so the caller's element owns layout.
 * - default (block): multi-line fields (section bodies, report summaries). Lists, paragraphs,
 *   and fenced code render; single newlines stay line breaks, as `whitespace-pre-wrap` did.
 *
 * Memoized on its (primitive) props, like chat's `MemoizedMarkdownBlock`: a card re-rendering
 * while it streams in only re-parses the fields whose text actually changed.
 */

type MarkdownNodeProps<T extends keyof React.JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<T> & { node?: unknown };

function Link({ node: _node, className, children, ...props }: MarkdownNodeProps<"a">) {
  return (
    <a
      {...props}
      className={cn("text-accent underline-offset-2 hover:underline", className)}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function Strong({ node: _node, ...props }: MarkdownNodeProps<"strong">) {
  return <strong {...props} className="font-semibold text-foreground" />;
}

const inlineComponents: Components = {
  // Unwrap paragraphs: the caller already renders a <p>/<li>/<span> around the text.
  p: ({ children }) => <>{children}</>,
  a: Link,
  strong: Strong,
  code: chatMarkdownCodeComponents.code,
};

const INLINE_ELEMENTS = ["p", "strong", "em", "del", "code", "a", "br"];

const blockComponents: Components = {
  ...inlineComponents,
  // `globals.css` sets every `<p>` to `text-base leading-snug`; inherit the card's own size and
  // leading instead, so a paragraph matches the list items beside it.
  p: ({ node: _node, ...props }) => (
    <p {...props} className="text-[length:inherit] leading-[inherit]" />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul {...props} className="list-disc space-y-1 pl-4 marker:text-muted-foreground/60" />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol {...props} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground/70" />
  ),
  li: ({ node: _node, ...props }) => <li {...props} className="pl-0.5" />,
  pre: ({ node: _node, ...props }) => (
    <chatMarkdownCodeComponents.pre
      {...props}
      className="rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground/90"
    />
  ),
};

/**
 * Turns single newlines into markdown hard breaks (two trailing spaces) outside fenced code,
 * so text written for `whitespace-pre-wrap` keeps its line structure. Blank lines, lists, and
 * fences parse as usual: trailing spaces at the end of a paragraph or list item are ignored.
 */
export function preserveLineBreaks(markdown: string): string {
  return markdown
    .split(/(^```[\s\S]*?^```[^\n]*$)/m)
    .map((segment, index) =>
      // Odd indexes are the captured fences; leave them byte-for-byte.
      index % 2 === 1 ? segment : segment.replace(/([^\n])\n(?=[^\n])/g, "$1  \n")
    )
    .join("");
}

type GenUIMarkdownProps = {
  /** Model text. Non-strings (fields still streaming in) render nothing. */
  children: unknown;
  inline?: boolean;
  /** Block mode only: classes for the wrapper `<div>`. */
  className?: string;
};

export const GenUIMarkdown = memo(function GenUIMarkdown({
  children,
  inline = false,
  className,
}: GenUIMarkdownProps) {
  if (typeof children !== "string" || children.length === 0) return null;

  if (inline) {
    return (
      <ReactMarkdown
        allowedElements={INLINE_ELEMENTS}
        components={inlineComponents}
        remarkPlugins={[remarkGfm]}
        unwrapDisallowed
      >
        {children}
      </ReactMarkdown>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <ReactMarkdown components={blockComponents} remarkPlugins={[remarkGfm]}>
        {preserveLineBreaks(children)}
      </ReactMarkdown>
    </div>
  );
});

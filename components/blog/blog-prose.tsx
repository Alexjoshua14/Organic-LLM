"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { TermWithDefinition, getTermDefinition } from "./term-with-definition";
import { MermaidDiagram } from "./mermaid-diagram";

import { CodeBlock } from "@/components/shared/code-block";
import {
  blogArticle,
  blogArticleBodyLayout,
  blogArticleContentClasses,
} from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

/** Remove all backticks and trim; used so inline code and terms never render with backticks. */
function stripBackticks(value: string): string {
  return value.replace(/`/g, "").trim();
}

/** Get a single string from ReactMarkdown code children (string or array of nodes). */
function getCodeChildrenString(children: unknown): string {
  if (children == null) return "";
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map((c) => (typeof c === "string" ? c : String(c))).join("");
  }

  return String(children);
}

/**
 * Blog / longform: `blogArticle` spacing tokens in `lib/rabbit-holes/designTokens` (tighter
 * than default Rabbit Hole `articleContent` section rhythm).
 */
export const BLOG_ARTICLE_BODY_CLASS = cn(...blogArticleContentClasses(), blogArticleBodyLayout);

/** @deprecated Use BLOG_ARTICLE_BODY_CLASS — kept for call sites (e.g. privacy page). */
export const PROSE_CLASS = BLOG_ARTICLE_BODY_CLASS;

export function BlogProse({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn(BLOG_ARTICLE_BODY_CLASS, className)}>
      <ReactMarkdown
        components={{
          code({ className: codeClassName, children, ...props }) {
            const raw = getCodeChildrenString(children).replace(/\n$/, "");
            const displayText = stripBackticks(raw) || raw;
            const hasLanguage =
              typeof codeClassName === "string" && codeClassName.includes("language-");
            const isBlock = hasLanguage || raw.includes("\n");
            const isMermaid =
              isBlock &&
              typeof codeClassName === "string" &&
              codeClassName.includes("language-mermaid");

            if (isMermaid) {
              return (
                <div data-syntax-highlighted className={blogArticle.mermaidBlock}>
                  <MermaidDiagram code={raw.trim()} />
                </div>
              );
            }
            if (isBlock) {
              const codeText = raw.trim();

              return (
                <div data-syntax-highlighted>
                  <CodeBlock
                    className="border border-border/40 bg-card/30 p-4 font-mono text-sm leading-relaxed text-foreground/90 dark:bg-black/20"
                    containerClassName={blogArticle.codeBlockContainer}
                  >
                    <code
                      className={cn(
                        "font-mono",
                        typeof codeClassName === "string" && codeClassName
                      )}
                    >
                      {codeText}
                    </code>
                  </CodeBlock>
                </div>
              );
            }
            const definition = getTermDefinition(displayText);

            if (definition) {
              return <TermWithDefinition definition={definition} term={displayText} />;
            }

            return (
              <code
                className={cn(
                  "rounded bg-card/50 px-1.5 py-0.5 font-mono text-sm text-foreground/90",
                  codeClassName
                )}
                {...props}
              >
                {displayText}
              </code>
            );
          },
          pre: ({ children }) => {
            const child = Array.isArray(children) ? children[0] : children;
            const isUpgraded =
              child &&
              typeof child === "object" &&
              "props" in child &&
              (child as { props?: { "data-syntax-highlighted"?: boolean } }).props?.[
                "data-syntax-highlighted"
              ];

            if (isUpgraded) {
              return <>{children}</>;
            }

            return (
              <CodeBlock
                className="border border-border/40 bg-card/30 p-4 font-mono text-sm leading-relaxed text-foreground/90 dark:bg-black/20"
                containerClassName={blogArticle.codeBlockContainer}
              >
                {children}
              </CodeBlock>
            );
          },
          h1: ({ children, ...hProps }) => (
            <h1 className={blogArticle.h1.element} {...hProps}>
              {children}
            </h1>
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

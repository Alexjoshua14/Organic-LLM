"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { TermWithDefinition, getTermDefinition } from "./term-with-definition";
import { MermaidDiagram } from "./mermaid-diagram";
import { cn } from "@/lib/utils";

function getLanguageFromClass(className: unknown): string {
  if (typeof className !== "string") return "text";
  const match = /language-(\w+)/.exec(className);
  return match ? match[1] : "text";
}

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

const PROSE_CLASS = cn(
  "prose prose-neutral dark:prose-invert max-w-none",
  "prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground",
  "prose-th:text-foreground prose-td:text-foreground",
  "prose-a:text-foreground prose-a:underline prose-a:decoration-foreground/40 prose-a:hover:decoration-foreground",
  "prose-code:text-foreground prose-code:bg-secondary prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm",
  "prose-pre:bg-white/10 dark:prose-pre:bg-black/20 prose-pre:backdrop-blur-md prose-pre:rounded-lg prose-pre:border prose-pre:border-border/50 prose-pre:px-4 prose-pre:py-3",
);

const glassPreClass =
  "overflow-x-auto rounded-lg border border-border/50 bg-white/10 px-4 py-3 backdrop-blur-md dark:bg-black/20";

export function BlogProse({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn(PROSE_CLASS, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className: codeClassName, children, ...props }) {
            const raw = getCodeChildrenString(children).replace(/\n$/, "");
            const displayText = stripBackticks(raw) || raw;
            const hasLanguage =
              typeof codeClassName === "string" &&
              codeClassName.includes("language-");
            const isBlock = hasLanguage || raw.includes("\n");
            const isMermaid =
              isBlock &&
              typeof codeClassName === "string" &&
              codeClassName.includes("language-mermaid");

            if (isMermaid) {
              return <MermaidDiagram code={raw.trim()} />;
            }
            if (isBlock) {
              const lang = getLanguageFromClass(codeClassName);
              const code = raw.trim();
              return (
                <div
                  className={cn(glassPreClass, "overflow-hidden")}
                  data-syntax-highlighted
                >
                  <SyntaxHighlighter
                    PreTag="div"
                    codeTagProps={{ className: "font-mono text-sm" }}
                    customStyle={{
                      margin: 0,
                      padding: "1rem 1.25rem",
                      fontSize: "0.875rem",
                      background: "transparent",
                      border: "none",
                    }}
                    language={lang}
                    style={oneLight}
                    className="my-0! overflow-x-auto rounded-lg dark:hidden"
                  >
                    {code}
                  </SyntaxHighlighter>
                  <SyntaxHighlighter
                    PreTag="div"
                    codeTagProps={{ className: "font-mono text-sm" }}
                    customStyle={{
                      margin: 0,
                      padding: "1rem 1.25rem",
                      fontSize: "0.875rem",
                      background: "transparent",
                      border: "none",
                    }}
                    language={lang}
                    style={oneDark}
                    className="my-0! hidden overflow-x-auto rounded-lg dark:block"
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              );
            }
            const definition = getTermDefinition(displayText);
            if (definition) {
              return (
                <TermWithDefinition
                  term={displayText}
                  definition={definition}
                />
              );
            }
            return (
              <code
                className={cn(
                  "rounded bg-secondary px-1 py-0.5 font-mono text-sm text-foreground",
                  codeClassName,
                )}
                {...props}
              >
                {displayText}
              </code>
            );
          },
          pre: ({ children, ...props }) => {
            const child = Array.isArray(children) ? children[0] : children;
            const isHighlighted =
              child &&
              typeof child === "object" &&
              "props" in child &&
              (child as { props?: { "data-syntax-highlighted"?: boolean } })
                .props?.["data-syntax-highlighted"];
            if (isHighlighted) {
              return <>{children}</>;
            }
            return (
              <pre className={glassPreClass} {...props}>
                {children}
              </pre>
            );
          },
          h1: ({ children, ...props }) => (
            <h1 className="font-normal text-foreground" {...props}>
              {children}
            </h1>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export { PROSE_CLASS };

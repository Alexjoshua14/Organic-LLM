"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

import { cn } from "@/lib/utils";

const glassPreClass =
  "overflow-x-auto rounded-lg border border-border/50 bg-white/10 px-4 py-3 backdrop-blur-md dark:bg-black/20";

export function CodeBlock({
  code,
  language = "text",
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  const trimmed = code.trim();

  return (
    <div data-syntax-highlighted className={cn(glassPreClass, "overflow-hidden my-4", className)}>
      <SyntaxHighlighter
        PreTag="div"
        className="my-0! overflow-x-auto rounded-lg dark:hidden"
        codeTagProps={{ className: "font-mono text-sm" }}
        customStyle={{
          margin: 0,
          padding: "1rem 1.25rem",
          fontSize: "0.875rem",
          background: "transparent",
          border: "none",
        }}
        language={language}
        style={oneLight}
      >
        {trimmed}
      </SyntaxHighlighter>
      <SyntaxHighlighter
        PreTag="div"
        className="my-0! hidden overflow-x-auto rounded-lg dark:block"
        codeTagProps={{ className: "font-mono text-sm" }}
        customStyle={{
          margin: 0,
          padding: "1rem 1.25rem",
          fontSize: "0.875rem",
          background: "transparent",
          border: "none",
        }}
        language={language}
        style={oneDark}
      >
        {trimmed}
      </SyntaxHighlighter>
    </div>
  );
}

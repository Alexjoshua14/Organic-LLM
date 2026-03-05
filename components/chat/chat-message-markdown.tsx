import { marked } from "marked";
import { CheckIcon, CopyIcon } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);

  return tokens.map((token) => token.raw);
}

function CodeBlockWrapper({
  children,
  ...props
}: React.ComponentPropsWithoutRef<"pre">) {
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
    <div className="relative group/codeblock rounded-lg transition-shadow duration-200 group-hover/codeblock:shadow-[0_0_20px_-4px_hsl(var(--border)),0_0_0_1px_hsl(var(--border)/0.5)]">
      <pre ref={preRef} {...props}>
        {children}
      </pre>
      <Button
        type="button"
        variant="secondaryInteractive"
        size="icon"
        className={cn(
          "absolute top-2 right-2 h-8 w-8 shrink-0 opacity-0 transition-opacity",
          "group-hover/codeblock:opacity-100 focus:opacity-100",
          "hover:bg-secondary/95! hover:from-secondary/95! hover:to-[#e8e6e1]! dark:hover:from-[#252625]! dark:hover:to-[#1e1f1e]!"
        )}
        onClick={handleCopy}
        aria-label={isCopied ? "Copied" : "Copy code"}
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

const markdownComponents = {
  pre: CodeBlockWrapper,
};

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;

    return true;
  },
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const ChatMessageMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return blocks.map((block, index) => (
      <MemoizedMarkdownBlock key={`${id}-block_${index}`} content={block} />
    ));
  },
);

ChatMessageMarkdown.displayName = "ChatMessageMarkdown";

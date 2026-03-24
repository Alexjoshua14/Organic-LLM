import { marked } from "marked";
import { CheckIcon, CopyIcon } from "lucide-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

const InBlockCodeContext = createContext(false);

/** When true (e.g. composer preview), fenced code wraps instead of expanding width / scrolling horizontally. */
const WrapCodeBlocksContext = createContext(false);

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);

  return tokens.map((token) => token.raw);
}

function CodeBlockWrapper({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const wrapCodeBlocks = useContext(WrapCodeBlocksContext);

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
    <InBlockCodeContext.Provider value={true}>
      <div
        className={cn(
          "relative group/codeblock max-w-full min-w-0 rounded-lg transition-shadow duration-200 group-hover/codeblock:shadow-[0_0_20px_-4px_hsl(var(--border)),0_0_0_1px_hsl(var(--border)/0.5)]",
          wrapCodeBlocks ? "overflow-x-hidden" : "overflow-x-auto"
        )}
      >
        <pre
          ref={preRef}
          className={cn(
            "min-w-0 max-w-full",
            wrapCodeBlocks
              ? "overflow-x-hidden whitespace-pre-wrap wrap-break-word"
              : "overflow-x-auto",
            props.className
          )}
          {...props}
        >
          {children}
        </pre>
        {!wrapCodeBlocks && (
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
        )}
      </div>
    </InBlockCodeContext.Provider>
  );
}

function InlineCode({ className, ...props }: React.ComponentPropsWithoutRef<"code">) {
  const inBlockCode = useContext(InBlockCodeContext);
  const wrapCodeBlocks = useContext(WrapCodeBlocksContext);
  const raw = (props.children ?? "").toString();
  const language =
    typeof className === "string" && className.includes("language-")
      ? className.split("language-")[1]?.split(" ")[0]
      : undefined;

  if (inBlockCode && language === "mermaid") {
    return <MermaidDiagram code={raw} expandOnDoubleClick />;
  }

  return (
    <code
      className={cn(
        !inBlockCode && "max-w-full wrap-break-word overflow-x-auto",
        inBlockCode && wrapCodeBlocks && "wrap-anywhere",
        className
      )}
      {...props}
    />
  );
}

const markdownComponents = {
  pre: CodeBlockWrapper,
  code: InlineCode,
};

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return (
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;

    return true;
  }
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export type ChatMessageMarkdownProps = {
  content: string;
  id: string;
  /** Fenced code wraps within the container (e.g. narrow composer preview). */
  wrapCodeBlocks?: boolean;
};

export const ChatMessageMarkdown = memo(
  ({ content, id, wrapCodeBlocks = false }: ChatMessageMarkdownProps) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return (
      <WrapCodeBlocksContext.Provider value={wrapCodeBlocks}>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock key={`${id}-block_${index}`} content={block} />
        ))}
      </WrapCodeBlocksContext.Provider>
    );
  },
  (prev, next) =>
    prev.content === next.content &&
    prev.id === next.id &&
    prev.wrapCodeBlocks === next.wrapCodeBlocks
);

ChatMessageMarkdown.displayName = "ChatMessageMarkdown";

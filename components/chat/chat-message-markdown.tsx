import { marked } from "marked";
import { createContext, memo, useContext, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { CodeBlock, CodeInline } from "@/components/shared/code-block";

const InBlockCodeContext = createContext(false);

/** When true (e.g. composer preview), fenced code wraps instead of expanding width / scrolling horizontally. */
const WrapCodeBlocksContext = createContext(false);

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);

  return tokens.map((token) => token.raw);
}

function CodeBlockWrapper({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const wrapCodeBlocks = useContext(WrapCodeBlocksContext);

  return (
    <InBlockCodeContext.Provider value={true}>
      <CodeBlock wrap={wrapCodeBlocks} {...props}>
        {children}
      </CodeBlock>
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
    <CodeInline className={className} inBlockCode={inBlockCode} wrap={wrapCodeBlocks} {...props} />
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

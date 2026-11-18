import { BlogFigure } from "./blog-figure";

import { CodeBlock } from "@/components/shared/code-block";

/**
 * A code sample in a TSX post. It renders through the shared fenced-code block (header, copy,
 * wrap, syntax colours; docs/design/code-blocks.md), the same one chat and Markdown posts use,
 * and steps out to the figure width on larger frames. Markdown posts just use a fence.
 */
export function BlogCode({
  code,
  language = "text",
  caption,
}: {
  code: string;
  language?: string;
  caption?: string;
}) {
  return (
    <BlogFigure caption={caption}>
      <CodeBlock>
        <code className={`language-${language}`}>{code.trim()}</code>
      </CodeBlock>
    </BlogFigure>
  );
}

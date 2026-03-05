import fs from "fs";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const DOC_PATH = path.join(
  process.cwd(),
  "components/background/ADAPTIVE_LIQUID_CHROME.md",
);

function getContent(): string {
  try {
    return fs.readFileSync(DOC_PATH, "utf-8");
  } catch {
    return "# Adaptive Liquid Chrome\n\nDocumentation could not be loaded.";
  }
}

export default function AdaptiveLiquidChromePostPage() {
  const content = getContent();

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <nav className="mb-8">
        <Link
          href="/blog"
          className="text-sm text-foreground hover:underline"
        >
          ← Blog
        </Link>
      </nav>
      <article className="rounded-xl border border-border bg-secondary p-6 sm:p-8 text-foreground">
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-code:bg-secondary prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-th:text-foreground prose-td:text-foreground prose-a:text-foreground prose-a:underline prose-a:decoration-foreground/40 prose-a:hover:decoration-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}

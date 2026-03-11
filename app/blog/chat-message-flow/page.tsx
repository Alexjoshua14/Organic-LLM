import fs from "fs";
import path from "path";
import Link from "next/link";
import { BlogProse } from "@/components/blog/blog-prose";

const CONTENT_PATH = path.join(
  process.cwd(),
  "content/blog/chat-message-flow.md",
);

function getContent(): string {
  try {
    return fs.readFileSync(CONTENT_PATH, "utf-8");
  } catch {
    return "# Chat Message Flow\n\nContent could not be loaded.";
  }
}

export default function ChatMessageFlowPostPage() {
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
      <article className="p-6 sm:p-8 text-foreground">
        <BlogProse content={content} />
      </article>
    </div>
  );
}

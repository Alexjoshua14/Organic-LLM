import fs from "fs";
import path from "path";

import Link from "next/link";

import { BlogProse } from "@/components/blog/blog-prose";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";

const DOC_PATH = path.join(process.cwd(), "content/blog/export-prompt-presets.md");

function getContent(): string {
  try {
    return fs.readFileSync(DOC_PATH, "utf-8");
  } catch {
    return "# Export Prompt Presets\n\nDocumentation could not be loaded.";
  }
}

export default function ExportPromptPresetsPostPage() {
  const content = getContent();

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-8">
      <nav className={blogArticlePage.navToContent}>
        <Link className="text-sm text-foreground hover:underline" href="/blog">
          ← Blog
        </Link>
      </nav>
      <article className="p-6 sm:p-8 text-foreground">
        <BlogProse content={content} />
      </article>
    </div>
  );
}

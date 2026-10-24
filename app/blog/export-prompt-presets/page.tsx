import fs from "fs";
import path from "path";

import { BlogProse } from "@/components/blog/blog-prose";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
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
    <PageContentFrame maxWidth="3xl">
      <PageNavBack className={blogArticlePage.navToContent} href="/blog">
        ← Blog
      </PageNavBack>
      <article className="p-6 sm:p-8 text-foreground">
        <BlogProse content={content} />
      </article>
    </PageContentFrame>
  );
}

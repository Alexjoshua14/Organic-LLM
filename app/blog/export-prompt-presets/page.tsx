import fs from "fs";
import path from "path";

import { BlogArticleShell } from "@/components/blog/blog-article-shell";
import { BlogProse } from "@/components/blog/blog-prose";

const DOC_PATH = path.join(process.cwd(), "content/blog/export-prompt-presets.md");

function getContent(): string {
  try {
    return fs.readFileSync(DOC_PATH, "utf-8");
  } catch {
    return "# Take your work to another AI\n\nThis post could not be loaded.";
  }
}

export default function ExportPromptPresetsPostPage() {
  return (
    <BlogArticleShell slug="export-prompt-presets">
      <BlogProse content={getContent()} />
    </BlogArticleShell>
  );
}

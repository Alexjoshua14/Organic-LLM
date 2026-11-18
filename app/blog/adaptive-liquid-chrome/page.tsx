import fs from "fs";
import path from "path";

import { BlogArticleShell } from "@/components/blog/blog-article-shell";
import { BlogProse } from "@/components/blog/blog-prose";

const DOC_PATH = path.join(process.cwd(), "content/blog/adaptive-liquid-chrome.md");

function getContent(): string {
  try {
    return fs.readFileSync(DOC_PATH, "utf-8");
  } catch {
    return "# A background that steps back\n\nThis post could not be loaded.";
  }
}

export default function AdaptiveLiquidChromePostPage() {
  return (
    <BlogArticleShell slug="adaptive-liquid-chrome">
      <BlogProse content={getContent()} />
    </BlogArticleShell>
  );
}

import fs from "fs";
import path from "path";

import Link from "next/link";

import { BlogProse } from "@/components/blog/blog-prose";

const DOC_PATH = path.join(process.cwd(), "components/background/ADAPTIVE_LIQUID_CHROME.md");

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

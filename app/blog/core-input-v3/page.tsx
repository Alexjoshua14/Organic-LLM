import type { Metadata } from "next";

import { BlogArticleShell } from "@/components/blog/blog-article-shell";
import { CoreInputV3Content } from "@/content/blog/core-input-v3-content";

export const metadata: Metadata = {
  title: "CoreInput v3",
  description:
    "Rebuilding Organic LLM's composer: what v2 got wrong on mobile, the editors weighed, the v3 design, and Lumen's light-mode answer.",
};

/** The post carries its own kicker and header, so the shell's meta line is left out. */
export default function CoreInputV3PostPage() {
  return (
    <BlogArticleShell meta={null} slug="core-input-v3">
      <CoreInputV3Content />
    </BlogArticleShell>
  );
}

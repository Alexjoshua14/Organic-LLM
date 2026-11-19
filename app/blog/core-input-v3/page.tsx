import type { Metadata } from "next";

import { CoreInputV3Content } from "@/content/blog/core-input-v3-content";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";

export const metadata: Metadata = {
  title: "CoreInput v3",
  description:
    "Rebuilding Organic LLM's composer: what v2 got wrong on mobile, the editors weighed, the v3 design, and Lumen's light-mode answer.",
};

export default function CoreInputV3PostPage() {
  return (
    <PageContentFrame maxWidth="2xl">
      <PageNavBack href="/blog">← Blog</PageNavBack>
      <article className="p-inset-md text-foreground sm:p-inset-lg">
        <CoreInputV3Content />
      </article>
    </PageContentFrame>
  );
}

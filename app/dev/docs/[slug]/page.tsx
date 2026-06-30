import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { BlogProse } from "@/components/blog/blog-prose";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { loadDevDocMarkdown } from "@/lib/dev-docs/load-doc";
import {
  DEV_DOCS,
  DEV_DOC_CATEGORY_LABELS,
  getDevDocBySlug,
} from "@/lib/dev-docs/registry";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return DEV_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDevDocBySlug(slug);

  if (!doc) {
    return {};
  }

  return {
    title: `${doc.title} · Dev docs`,
    description: doc.description,
  };
}

export default async function DevDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDevDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const content = loadDevDocMarkdown(slug);

  return (
    <PageContentFrame maxWidth="2xl">
      <PageNavBack className={blogArticlePage.navToContent} href="/dev/docs">
        ← Developer docs
      </PageNavBack>
      <article className={cn("p-6 text-foreground sm:p-8", blogArticlePage.blockStack)}>
        <p className="text-xs text-muted-foreground">
          {DEV_DOC_CATEGORY_LABELS[doc.category]} · Updated {doc.updated}
        </p>
        <BlogProse content={content} />
      </article>
    </PageContentFrame>
  );
}

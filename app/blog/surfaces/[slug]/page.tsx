import type { Metadata } from "next";

import { SurfacePostLayout } from "@/components/blog/surface-post-layout";
import {
  getAllSurfaceBlogSlugs,
  getSurfaceBlogMarkdown,
  getSurfaceBlogMeta,
} from "@/lib/blog/surface-posts";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllSurfaceBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = getSurfaceBlogMeta(slug);

  if (!meta) return { title: "Surface" };

  return {
    title: `${meta.label} · Organic LLM surfaces`,
    description: meta.description,
  };
}

export default async function SurfaceBlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const meta = getSurfaceBlogMeta(slug);

  if (!meta) notFound();

  const markdown = getSurfaceBlogMarkdown(slug);

  return <SurfacePostLayout markdown={markdown} surface={meta} />;
}

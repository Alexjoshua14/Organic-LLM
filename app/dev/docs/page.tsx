import type { Metadata } from "next";

import Link from "next/link";

import { PageContentFrame } from "@/components/layout/page-content-frame";
import {
  DEV_DOC_CATEGORIES,
  DEV_DOC_CATEGORY_LABELS,
  DEV_DOCS,
} from "@/lib/dev-docs/registry";

export const metadata: Metadata = {
  title: "Developer docs",
  description:
    "Internal feature guides for Organic LLM — Noesis, composer preferences, and implementation maps.",
};

export default function DevDocsIndexPage() {
  return (
    <PageContentFrame maxWidth="2xl">
      <h1 className="mb-2 text-2xl font-normal text-foreground">Developer docs</h1>
      <p className="mb-8 text-sm text-secondary-foreground">
        Feature-focused guides for engineers extending chat, sandbox experiences, and shared
        composer UI. Sources live in{" "}
        <code className="rounded bg-card/50 px-1.5 py-0.5 font-mono text-sm">content/dev-docs/</code>
        .
      </p>
      <div className="space-y-10">
        {DEV_DOC_CATEGORIES.map((category) => {
          const docsInCategory = DEV_DOCS.filter((doc) => doc.category === category);

          if (docsInCategory.length === 0) return null;

          return (
            <section key={category}>
              <h2 className="mb-4 text-lg font-medium text-foreground">
                {DEV_DOC_CATEGORY_LABELS[category]}
              </h2>
              <ul className="space-y-4">
                {docsInCategory.map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      className="block rounded-lg border border-border bg-secondary p-4 text-foreground no-underline transition-colors hover:bg-secondary/80"
                      href={`/dev/docs/${doc.slug}`}
                    >
                      <h3 className="font-medium text-foreground">{doc.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
                      <p className="mt-2 text-[11px] tabular-nums text-muted-foreground/80">
                        Updated {doc.updated}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PageContentFrame>
  );
}

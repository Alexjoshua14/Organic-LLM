"use client";

import { CollapsibleSection } from "./collapsible-section";
import { BlogProse } from "./blog-prose";

type Section = {
  title: string;
  overview: string;
  tableMarkdown: string;
};

export function MemoryEncryptionDesignSpace({
  sections,
}: {
  sections: readonly Section[];
}) {
  return (
    <div className="space-y-1">
      {sections.map((section) => (
        <CollapsibleSection
          key={section.title}
          title={section.title}
          summary={section.overview}
        >
          <BlogProse content={section.tableMarkdown} />
        </CollapsibleSection>
      ))}
    </div>
  );
}

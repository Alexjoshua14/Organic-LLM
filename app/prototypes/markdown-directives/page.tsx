"use client";

import { DirectiveRenderer } from "./_components/DirectiveRenderer";

/**
 * Sample markdown containing leaf directives. These are parsed and rendered
 * as the corresponding components from the registry (see _lib/componentRegistry.ts).
 */
const SAMPLE_MARKDOWN = `
Here is a **knowledge card** and a timeline.

::knowledge-card{ query="project alpha deadlines" limit="5" view="timeline" }

And a timeline:

::timeline{ view="timeline" }

And a data table:

::data-table{ }

Normal markdown still works: *italic*, [links](https://example.com), and lists.

Unknown directives show a fallback: ::unknown-thing{ foo="bar" }
`.trim();

export default function MarkdownDirectivesPrototypePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold">Extended Markdown Directives (MVP)</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Directives use the syntax <code>::name&#123; key=&quot;value&quot; &#125;</code>. See README in this folder for flow and how to extend.
      </p>
      <div className="prose dark:prose-invert">
        <DirectiveRenderer content={SAMPLE_MARKDOWN} />
      </div>
    </div>
  );
}

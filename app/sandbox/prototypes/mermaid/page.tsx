"use client";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";

/**
 * Mermaid render harness.
 *
 * Standalone fixtures exercising the strict-mode + sanitized render path used
 * in Arcadia chat. Drives tests/e2e/mermaid.spec.ts (real-browser render is the
 * only place Mermaid's full pipeline runs — JSDOM lacks CSSStyleSheet).
 */
const FIXTURES: { id: string; title: string; code: string; expectError?: boolean }[] = [
  {
    id: "flowchart",
    title: "Flowchart (quoted edge labels)",
    code: [
      "flowchart TD",
      '  Start["Receive request"] --> Validate["Validate input"]',
      '  Validate -->|"ok"| Process["Process order"]',
      '  Validate -->|"invalid"| Reject["Return 400"]',
    ].join("\n"),
  },
  {
    id: "sequence",
    title: "Sequence diagram",
    code: [
      "sequenceDiagram",
      "  participant User",
      "  participant API",
      "  User->>API: Submit form",
      "  API-->>User: 200 OK",
    ].join("\n"),
  },
  {
    id: "state",
    title: "State machine",
    code: [
      "stateDiagram-v2",
      "  [*] --> Idle",
      "  Idle --> Running: start",
      "  Running --> Idle: stop",
      "  Running --> [*]",
    ].join("\n"),
  },
  {
    id: "subgraph",
    title: "Subgraph grouping (quoted titles + special-char labels)",
    code: [
      "flowchart LR",
      '  subgraph Core["Aetherion Core AI"]',
      '    Mem["Memory"] --> Cog["Cognition"]',
      "  end",
      '  Core --> UI["Arcadia: UI & Knowledge"]',
    ].join("\n"),
  },
  {
    id: "special-labels",
    title: "Special characters (must be quoted)",
    code: ["flowchart LR", '  A["Cost (USD)"] --> B["Tax @ 8%"]', '  B --> C["Total: $108"]'].join(
      "\n"
    ),
  },
  {
    id: "invalid",
    title: "Invalid source → graceful error",
    code: ["flowchart TD", "  My Node --> Other (oops)"].join("\n"),
    expectError: true,
  },
];

export default function MermaidPrototypePage() {
  return (
    <Page>
      {/* The app shell is height-locked (overflow-hidden); the frame owns the scroll. */}
      <PageContentFrame maxWidth="3xl" className="h-full overflow-y-auto pb-16">
        <PageNavBack className="mb-8" href="/sandbox/prototypes">
          ← Prototypes
        </PageNavBack>

        <h1 className="mb-2 text-2xl font-light tracking-tight text-foreground">
          Mermaid render harness
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Fixtures for the strict-mode, sanitized Mermaid pipeline. Each block renders an SVG; the
          last one is intentionally invalid and must degrade to a readable error.
        </p>

        <div className="flex flex-col gap-8">
          {FIXTURES.map((f) => (
            <section key={f.id} data-testid={`mermaid-case-${f.id}`}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {f.title}
              </h2>
              <div className="rounded-xl border border-border/60 bg-background-tertiary/20 p-4">
                <MermaidDiagram code={f.code} expandOnDoubleClick={!f.expectError} />
              </div>
            </section>
          ))}
        </div>
      </PageContentFrame>
    </Page>
  );
}

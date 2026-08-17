"use client";

import { useEffect, useState } from "react";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { MermaidToolDiagram } from "@/components/mermaid/mermaid-tool-diagram";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { DiagramNodeLinksProvider } from "@/lib/mermaid/diagram-node-links-context";
import { DiagramTakeoverProvider } from "@/lib/mermaid/diagram-takeover-context";
import { DiagramTakeoverShell } from "@/components/mermaid/diagram-takeover-shell";
import { cn } from "@/lib/utils";

type Fixture = {
  id: string;
  title: string;
  code?: string;
  toolOutput?: Record<string, unknown>;
  expectError?: boolean;
};

const DENSE_OVERVIEW = [
  "flowchart TD",
  '  A["Client"] --> B["API Gateway"]',
  '  B --> C["Auth"]',
  '  B --> D["Chat Service"]',
  '  D --> E["LLM Router"]',
  '  E --> F["Model A"]',
  '  E --> G["Model B"]',
].join("\n");

const DENSE_DETAILED = [
  "flowchart TD",
  '  A["Client"] --> B["API Gateway"]',
  '  B --> C["Auth"]',
  '  B --> D["Chat Service"]',
  '  C --> C1["JWT verify"]',
  '  C --> C2["Session store"]',
  '  D --> D1["Message pack"]',
  '  D --> D2["Tool runner"]',
  '  D --> E["LLM Router"]',
  '  E --> F["Model A"]',
  '  E --> G["Model B"]',
  '  D2 --> H["Mermaid gen"]',
  '  D2 --> I["Web search"]',
  '  H --> J["Validate + repair"]',
].join("\n");

const FIXTURES: Fixture[] = [
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
    id: "subgraph",
    title: "Subgraph grouping (cluster token styling)",
    code: [
      "flowchart LR",
      '  subgraph Core["Aetherion Core AI"]',
      '    Mem["Memory"] --> Cog["Cognition"]',
      "  end",
      '  Core --> UI["Arcadia: UI & Knowledge"]',
    ].join("\n"),
  },
  {
    id: "dual-source",
    title: "Dual-source tool output (overview inline, detailed on expand)",
    toolOutput: {
      success: true,
      density: "detailed",
      title: "Chat request path",
      overviewCode: DENSE_OVERVIEW,
      detailedCode: DENSE_DETAILED,
      code: DENSE_OVERVIEW,
    },
  },
  {
    id: "invalid",
    title: "Invalid source → graceful error",
    code: ["flowchart TD", "  My Node --> Other (oops)"].join("\n"),
    expectError: true,
  },
];

export default function MermaidPrototypePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const apply = () => {
      document.documentElement.classList.toggle("motion-reduce", reduceMotion);
      document.documentElement.classList.toggle("motion-safe", !reduceMotion);
    };

    apply();
    mq.addEventListener("change", apply);

    return () => mq.removeEventListener("change", apply);
  }, [reduceMotion]);

  return (
    <Page>
      <DiagramNodeLinksProvider>
        <DiagramTakeoverProvider>
      <PageContentFrame maxWidth="3xl" className="h-full overflow-y-auto pb-16">
        <PageNavBack className="mb-8" href="/sandbox/prototypes">
          ← Prototypes
        </PageNavBack>

        <h1 className="mb-2 text-2xl font-light tracking-tight text-foreground">
          Mermaid variant lab
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Recessed-well styling, cluster tokens, staged reveal, and dual-source fixtures. Toggle
          theme and motion to direct the look before takeover chrome ships.
        </p>

        <div className="mb-8 flex flex-wrap gap-2">
          <button
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs",
              theme === "light" ? "border-border bg-background-tertiary/40" : "border-border/50"
            )}
            type="button"
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs",
              theme === "dark" ? "border-border bg-background-tertiary/40" : "border-border/50"
            )}
            type="button"
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
          <button
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs",
              reduceMotion ? "border-border bg-background-tertiary/40" : "border-border/50"
            )}
            type="button"
            onClick={() => setReduceMotion((v) => !v)}
          >
            Reduced motion: {reduceMotion ? "on" : "off"}
          </button>
        </div>

        <div className="flex flex-col gap-10">
          {FIXTURES.map((f) => (
            <section key={f.id} data-testid={`mermaid-case-${f.id}`}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {f.title}
              </h2>
              {f.toolOutput ? (
                <MermaidToolDiagram
                  interactive
                  output={f.toolOutput}
                  toolCallId={`lab-${f.id}`}
                />
              ) : (
                <MermaidDiagram code={f.code ?? ""} expandOnDoubleClick={!f.expectError} />
              )}
            </section>
          ))}
        </div>
      </PageContentFrame>
          <DiagramTakeoverShell />
        </DiagramTakeoverProvider>
      </DiagramNodeLinksProvider>
    </Page>
  );
}

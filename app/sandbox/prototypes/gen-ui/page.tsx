"use client";

import { useState } from "react";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GenUISkeleton } from "@/components/chat/gen-ui/GenUISkeleton";
import { GenUIFallbackMarkdown } from "@/components/chat/gen-ui/GenUIFallbackMarkdown";
import {
  ALL_VALID_FIXTURES,
  FIXTURE_DECISION_MATRIX_PARTIAL,
  FIXTURE_INVALID_BLOCK,
  FIXTURE_STREAMING_STAGES,
} from "@/lib/schemas/gen-ui/fixtures";

type GalleryTab = "valid" | "partial" | "invalid" | "streaming";

export default function GenUiPrototypePage() {
  const [tab, setTab] = useState<GalleryTab>("valid");
  const [streamIndex, setStreamIndex] = useState(0);

  const streamingInput = FIXTURE_STREAMING_STAGES[streamIndex] ?? FIXTURE_STREAMING_STAGES[0];

  const tabs: { id: GalleryTab; label: string }[] = [
    { id: "valid", label: "Valid (4 types)" },
    { id: "partial", label: "Partial recovery" },
    { id: "invalid", label: "Invalid → markdown" },
    { id: "streaming", label: "Streaming skeleton" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Gen UI blocks</h1>
        <p className="text-sm text-muted-foreground">
          Sandbox gallery for Arcadia structured blocks — registry, wrapper, and fallbacks.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tab === t.id
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            }
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "valid" ? (
        <div className="space-y-6">
          {ALL_VALID_FIXTURES.map((block, i) => (
            <section key={i} className="space-y-2">
              <p className="text-xs font-mono text-muted-foreground">{block.type}</p>
              <GenUIRenderer data={{ block }} messageId={`fixture-${i}`} />
            </section>
          ))}
        </div>
      ) : null}

      {tab === "partial" ? (
        <GenUIRenderer data={{ block: FIXTURE_DECISION_MATRIX_PARTIAL }} messageId="partial-matrix" />
      ) : null}

      {tab === "invalid" ? (
        <GenUIFallbackMarkdown messageId="invalid" raw={FIXTURE_INVALID_BLOCK} />
      ) : null}

      {tab === "streaming" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              disabled={streamIndex <= 0}
              onClick={() => setStreamIndex((i) => Math.max(0, i - 1))}
            >
              Prev stage
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              disabled={streamIndex >= FIXTURE_STREAMING_STAGES.length - 1}
              onClick={() =>
                setStreamIndex((i) => Math.min(FIXTURE_STREAMING_STAGES.length - 1, i + 1))
              }
            >
              Next stage
            </button>
            <span className="text-xs text-muted-foreground">
              Stage {streamIndex + 1} / {FIXTURE_STREAMING_STAGES.length}
            </span>
          </div>
          <GenUISkeleton
            partialInput={streamingInput as Record<string, unknown>}
            type={
              typeof streamingInput.type === "string"
                ? (streamingInput.type as "answer-card")
                : undefined
            }
          />
        </div>
      ) : null}
    </main>
  );
}

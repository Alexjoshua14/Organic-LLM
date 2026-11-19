"use client";

import { useMemo, useState } from "react";

import { BlogFigure } from "./blog-figure";

import { CodeBlock } from "@/components/shared/code-block";
import {
  buildChatGptPrompt,
  buildCursorInstruction,
  EXPORT_INTENT_PRESETS,
  getOpenInChatProviders,
  presetHasClipboardCursor,
} from "@/lib/export/prompts";
import { cn } from "@/lib/utils";

/** Invented source text. Nothing here is real user data. */
const SAMPLE_SOURCE =
  "Launch note: Orbit is a tiny weather app for runners. It tells you the best 30-minute window today and nothing else. Beta opens Friday.";

const DEMO_PRESET_IDS = [
  "script-voiceover-chatgpt",
  "script-storyboard-chatgpt",
  "cursor-code-analysis",
] as const;

const PROVIDER_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  t3: "T3",
  v0: "v0",
  scira: "Scira",
};

/**
 * The real preset registry and the real prompt builders, run on invented text. Pick a preset and
 * see exactly what Organic LLM would put on your clipboard. Nothing is sent anywhere: there is no
 * network call and no outbound link in this demo.
 */
export function ExportPresetDemo() {
  const presets = useMemo(
    () =>
      EXPORT_INTENT_PRESETS.filter((p) => (DEMO_PRESET_IDS as readonly string[]).includes(p.id)),
    []
  );
  const [id, setId] = useState<string>(presets[0]?.id ?? "");
  const preset = presets.find((p) => p.id === id) ?? presets[0];

  if (!preset) return null;

  const providers = getOpenInChatProviders(preset);
  const prompt = presetHasClipboardCursor(preset)
    ? buildCursorInstruction({ preset, sourceText: SAMPLE_SOURCE })
    : buildChatGptPrompt({ preset, sourceText: SAMPLE_SOURCE });

  return (
    <BlogFigure caption="The real presets and prompt builders, on invented text. Nothing is sent anywhere.">
      <div className="space-y-stack-lg rounded-xl border border-border bg-secondary/40 p-inset-xl">
        <div role="radiogroup" aria-label="Preset" className="flex flex-wrap gap-inline-sm">
          {presets.map((p) => (
            <button
              key={p.id}
              aria-checked={p.id === preset.id}
              className={cn(
                "organic-focus rounded-full border px-inset-lg py-stack-sm text-sm transition-colors",
                p.id === preset.id
                  ? "border-lumen-deep/60 bg-background text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              role="radio"
              type="button"
              onClick={() => setId(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-inline-md">
          <span className="rounded-md border border-border bg-background/60 px-inset-lg py-stack-sm text-sm text-foreground">
            {preset.buttonLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {providers.length > 0
              ? `Opens in ${providers.map((x) => PROVIDER_LABEL[x] ?? x).join(" or ")}`
              : "Copies to your clipboard"}
          </span>
        </div>

        <CodeBlock>
          <code className="language-markdown">{prompt}</code>
        </CodeBlock>
      </div>
    </BlogFigure>
  );
}

"use client";

import type { ReactNode } from "react";
import type { CodeDiffBlock, GenUIBlock } from "@/lib/schemas/gen-ui";

import { useId, useState } from "react";

import {
  useGenUiArrangementCycle,
  type GenUiArrangement,
} from "../_hooks/use-gen-ui-arrangement-cycle";
import { useGenUiLanguageRotation } from "../_hooks/use-gen-ui-language-rotation";

import { GenUiArrangementPauseZone, GenUiArrangementToolbar } from "./GenUiArrangementToolbar";
import { CondensedCard, GenUiCondensedBlock } from "./GenUiCondensedPreviews";
import { GenUiLanguageControls } from "./GenUiLanguageControls";
import {
  buildLanguageDiffBlock,
  LAB_LANGUAGE_IDS,
  LAB_LANGUAGES,
  sampleFor,
  snippetMarkdown,
} from "./lab-languages";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { HighlightedText } from "@/components/shared/code-highlight";
import { fontMono } from "@/config/fonts";
import { cn } from "@/lib/utils";

/**
 * The Code page: the code diff block's page, now covering both ways code reaches chat. They share
 * one set of primitives (`components/shared/code`), so they share one page and one language picker.
 *
 * - **Snippet**: a fenced block in a markdown reply, through the real chat renderer.
 * - **Diff**: the same language as the unified diff a model sends, through the registry.
 * - **Fixture**: the schema fixture, which "Generate with AI" replaces.
 * - The rest are fenced blocks for layout checks (gutter, shell, wide lines, plain, very long).
 */
export const LAB_CODE_LABEL = "Code";

function demoCodeFence(language: string, code: string) {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

const REFERENCE = [
  'import { z } from "zod";',
  "",
  "// Validate before the request goes out.",
  "const schema = z.object({",
  "  email: z.string().email(),",
  '  plan: z.enum(["free", "pro"]).default("free"),',
  "});",
  "",
  "type Subscription = z.infer<typeof schema>;",
  "",
  "export async function subscribe(input: unknown): Promise<Subscription> {",
  "  const body = schema.parse(input);",
  "",
  '  const response = await fetch("/api/subscribe", {',
  '    method: "POST",',
  '    headers: { "content-type": "application/json" },',
  "    body: JSON.stringify(body),",
  "  });",
  "",
  "  if (!response.ok) {",
  "    throw new Error(`Subscribe failed with ${response.status}`);",
  "  }",
  "",
  "  return body;",
  "}",
].join("\n");

const LONG_LINES = [
  'const message = "This line is deliberately long so that the wrap toggle and the horizontal scroll can both be judged against it, including how the hanging indent behaves.";',
  "  const nested = await Promise.all(items.map((item) => fetchItem(item.id, { signal, retries: 3, backoff: exponentialBackoff(250, 5_000) })));",
  "SELECT users.id, users.email, COUNT(events.id) AS event_count FROM users LEFT JOIN events ON events.user_id = users.id WHERE users.created_at > now() - interval '30 days' GROUP BY users.id;",
].join("\n");

/** Longer than the streaming threshold, so it checks the plain-then-colored path on a big block. */
const LONG_BLOCK = Array.from({ length: 90 }, (_, index) =>
  index % 9 === 0
    ? `// Step ${index / 9 + 1}`
    : `const value${index} = compute(${index}, "label-${index}"); // ${index * 3}`
).join("\n");

/** The language the Snippet slide opens on. */
const DEFAULT_LANGUAGE = "typescript";

type CodeSlide = "snippet" | "diff" | "fixture" | "markdown";

type CodePreset = GenUiArrangement & {
  kind: CodeSlide;
  /** For `markdown` slides: a complete assistant message, exactly as the chat renders it. */
  markdown?: string;
};

export const LAB_CODE_PRESETS: ReadonlyArray<CodePreset> = [
  {
    id: "snippet",
    kind: "snippet",
    name: "Snippet",
    intent:
      "One real change per language, fenced as a model would. Pick a language or shuffle; one block at a time.",
  },
  {
    id: "diff",
    kind: "diff",
    name: "Diff",
    intent:
      "The same language as the unified diff a model sends. The app finds the language from the file path.",
  },
  {
    id: "fixture",
    kind: "fixture",
    name: "Fixture",
    intent:
      "The schema fixture: three files with comments, folds and a rename. Generate with AI replaces it.",
  },
  {
    id: "reference",
    kind: "markdown",
    name: "Reference",
    intent:
      "A whole function you read top to bottom: line numbers, comments, types, indentation guides.",
    markdown: `Here is the complete module:\n\n${demoCodeFence('ts filename="lib/subscribe.ts"', REFERENCE)}`,
  },
  {
    id: "command",
    kind: "markdown",
    name: "Command",
    intent: "Shell is for copying. One line, one clear Copy code.",
    markdown: `Install and run the unit tests:\n\n${demoCodeFence("bash", "bun install\nbun run test:unit")}\n\nOr just one file:\n\n${demoCodeFence("sh", "bun run test:unit tests/unit/foo.test.ts --verbose")}`,
  },
  {
    id: "long-lines",
    kind: "markdown",
    name: "Long lines",
    intent: "Lines wider than the column. Toggle wrap in the header; it starts as a scroll.",
    markdown: `These lines are wider than the chat column:\n\n${demoCodeFence("ts", LONG_LINES)}`,
  },
  {
    id: "plain",
    kind: "markdown",
    name: "Plain",
    intent: "No language, or one we do not highlight. Same layout, no colors, still copyable.",
    markdown: `A fence with no language:\n\n${demoCodeFence("", "plain output\n  indented line\nlast line")}\n\nAnd one we do not know:\n\n${demoCodeFence("cobol", "IDENTIFICATION DIVISION.\nPROGRAM-ID. HELLO.")}`,
  },
  {
    id: "long-block",
    kind: "markdown",
    name: "Long block",
    intent: "Ninety lines, past the streaming threshold. Complete on mount, so it colors at once.",
    markdown: demoCodeFence("ts", LONG_BLOCK),
  },
];

const FIXTURE_INDEX = LAB_CODE_PRESETS.findIndex((preset) => preset.kind === "fixture");

/** Slides whose content follows the chosen language. */
function followsLanguage(preset: CodePreset) {
  return preset.kind === "snippet" || preset.kind === "diff";
}

export function useGenUiCodeDemo(active = true) {
  const cycle = useGenUiArrangementCycle(LAB_CODE_PRESETS, active);
  const languageSlide = followsLanguage(cycle.arrangement);
  // The language only shows on the Snippet and Diff slides, so it rotates only while one is open.
  const rotation = useGenUiLanguageRotation(
    LAB_LANGUAGE_IDS,
    DEFAULT_LANGUAGE,
    active && languageSlide
  );

  return {
    ...cycle,
    rotation,
    languageSlide,
    /** Show the fixture, e.g. after "Generate with AI" replaced it. */
    showFixture: () => cycle.select(FIXTURE_INDEX),
  };
}

type CodeDemoState = ReturnType<typeof useGenUiCodeDemo>;

export function GenUiCodeDemoToolbar({ demo }: { demo: CodeDemoState }) {
  return (
    <GenUiArrangementToolbar
      cycle={demo}
      extra={
        // The language shows on the Snippet and Diff slides, so its controls live there. The row
        // keeps its height on other slides so the arrows and the preview never move.
        <div className="min-h-9">
          {demo.languageSlide ? (
            <GenUiLanguageControls languages={LAB_LANGUAGES} rotation={demo.rotation} />
          ) : null}
        </div>
      }
      groupLabel="Code presets"
      noun="preset"
    />
  );
}

/** The slide: real markdown through the chat renderer, or a code-diff block through the registry. */
export function GenUiCodeDemo({
  demo,
  fixture,
  condensed = false,
}: {
  demo: CodeDemoState;
  /** The page's own schema fixture (what Generate with AI replaces). */
  fixture: GenUIBlock;
  condensed?: boolean;
}) {
  const preset = demo.arrangement;
  const sample = sampleFor(demo.rotation.language ?? DEFAULT_LANGUAGE);

  const diff = preset.kind === "diff" ? buildLanguageDiffBlock(sample) : null;
  // The first fence of the slide's message: its info string names the language, as in chat.
  const fence = (
    preset.kind === "snippet" ? snippetMarkdown(sample) : (preset.markdown ?? "")
  ).match(/```([^\n]*)\n([\s\S]*?)\n```/);
  const source = preset.kind === "snippet" ? sample.code : (fence?.[2] ?? "");
  const language = fence?.[1]?.trim().split(/\s+/)[0] || undefined;
  const fullPreview = diff ? (
    // Keyed by language so each step remounts, as a new message would.
    <GenUIRenderer
      key={sample.id}
      data={{ block: diff }}
      messageId={`lab-code-diff-${sample.id}`}
    />
  ) : preset.kind === "fixture" ? (
    <GenUIRenderer data={{ block: fixture }} messageId="lab-code-diff" />
  ) : (
    <div className="ai-message prose dark:prose-invert max-w-full space-y-stack-sm text-foreground">
      {/* Keyed by slide and language so each step remounts, as a new message would. */}
      <ChatMessageMarkdown
        key={`${preset.id}-${preset.kind === "snippet" ? sample.id : ""}`}
        content={preset.kind === "snippet" ? snippetMarkdown(sample) : (preset.markdown ?? "")}
        id={`lab-code-${preset.id}-${sample.id}`}
      />
    </div>
  );

  return (
    <GenUiArrangementPauseZone
      cycle={{
        count: demo.count,
        step: demo.step,
        setHovered: (value) => {
          demo.setHovered(value);
          demo.rotation.setHovered(value);
        },
        setFocused: (value) => {
          demo.setFocused(value);
          demo.rotation.setFocused(value);
        },
      }}
    >
      {condensed ? (
        <CondensedCodeDemo
          preset={preset}
          source={source}
          language={language}
          diff={preset.kind === "fixture" && fixture.type === "code-diff" ? fixture : diff}
          fullPreview={fullPreview}
        />
      ) : (
        fullPreview
      )}
    </GenUiArrangementPauseZone>
  );
}

function CondensedCodeDemo({
  preset,
  source,
  language,
  diff,
  fullPreview,
}: {
  preset: CodePreset;
  source: string;
  /** Fence language; unknown or missing renders plain, as in chat. */
  language: string | undefined;
  diff: CodeDiffBlock | null;
  fullPreview: ReactNode;
}) {
  if (diff) return <GenUiCondensedBlock block={diff}>{fullPreview}</GenUiCondensedBlock>;

  return (
    <CondensedCard title={preset.name}>
      {source ? (
        // Keyed by source so a new slide or language starts collapsed again.
        <CondensedCode key={source} language={language} source={source} />
      ) : (
        <p className="text-xs text-muted-foreground">{preset.intent}</p>
      )}
    </CondensedCard>
  );
}

/** Lines shown before the block is expanded in place. */
const CONDENSED_CODE_LINES = 4;

/**
 * One code surface that grows in place: the first few lines, then the rest under the same
 * header-less block when the reader asks. No second copy of the code below it.
 */
function CondensedCode({ source, language }: { source: string; language: string | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const regionId = useId();
  const lines = source.split("\n");
  const hidden = lines.length - CONDENSED_CODE_LINES;
  const shown = expanded ? lines : lines.slice(0, CONDENSED_CODE_LINES);

  return (
    // organic-code scopes the shared token palette (styles/CodePalette.css).
    <div
      className={cn(
        "organic-code overflow-hidden rounded-lg bg-muted/40 font-mono text-xs",
        fontMono.variable
      )}
    >
      <pre
        id={regionId}
        className={cn("p-inset-sm", expanded ? "overflow-x-auto" : "overflow-hidden")}
      >
        {shown.map((line, index) => (
          <span key={index} className={cn("block whitespace-pre", !expanded && "truncate")}>
            {line ? <HighlightedText language={language} text={line} /> : " "}
          </span>
        ))}
      </pre>
      {hidden > 0 ? (
        <button
          type="button"
          aria-controls={regionId}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="organic-focus flex min-h-11 w-full items-center justify-between gap-inline-sm border-t border-border/50 px-inset-sm font-sans text-muted-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <span>{expanded ? "Show less" : `Show all ${lines.length} lines`}</span>
          <span className="tabular-nums text-muted-foreground/70">
            {expanded ? `${lines.length} lines` : `+${hidden}`}
          </span>
        </button>
      ) : null}
    </div>
  );
}

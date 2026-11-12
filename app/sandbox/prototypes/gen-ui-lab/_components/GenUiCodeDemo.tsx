"use client";

import type { CodeDiffBlock, GenUIBlock } from "@/lib/schemas/gen-ui";

import {
  useGenUiArrangementCycle,
  type GenUiArrangement,
} from "../_hooks/use-gen-ui-arrangement-cycle";
import { useGenUiLanguageRotation } from "../_hooks/use-gen-ui-language-rotation";

import { GenUiArrangementPauseZone, GenUiArrangementToolbar } from "./GenUiArrangementToolbar";
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

const fence = (language: string, code: string) => `\`\`\`${language}\n${code}\n\`\`\``;

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
    markdown: `Here is the complete module:\n\n${fence("ts", REFERENCE)}`,
  },
  {
    id: "command",
    kind: "markdown",
    name: "Command",
    intent: "Shell is for copying. One line, one clear Copy code.",
    markdown: `Install and run the unit tests:\n\n${fence("bash", "bun install\nbun run test:unit")}\n\nOr just one file:\n\n${fence("sh", "bun run test:unit tests/unit/foo.test.ts --verbose")}`,
  },
  {
    id: "long-lines",
    kind: "markdown",
    name: "Long lines",
    intent: "Lines wider than the column. Toggle wrap in the header; it starts as a scroll.",
    markdown: `These lines are wider than the chat column:\n\n${fence("ts", LONG_LINES)}`,
  },
  {
    id: "plain",
    kind: "markdown",
    name: "Plain",
    intent: "No language, or one we do not highlight. Same layout, no colors, still copyable.",
    markdown: `A fence with no language:\n\n${fence("", "plain output\n  indented line\nlast line")}\n\nAnd one we do not know:\n\n${fence("cobol", "IDENTIFICATION DIVISION.\nPROGRAM-ID. HELLO.")}`,
  },
  {
    id: "long-block",
    kind: "markdown",
    name: "Long block",
    intent: "Ninety lines, past the streaming threshold. Complete on mount, so it colors at once.",
    markdown: fence("ts", LONG_BLOCK),
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
}: {
  demo: CodeDemoState;
  /** The page's own schema fixture (what Generate with AI replaces). */
  fixture: GenUIBlock;
}) {
  const preset = demo.arrangement;
  const sample = sampleFor(demo.rotation.language ?? DEFAULT_LANGUAGE);

  return (
    <GenUiArrangementPauseZone
      cycle={{
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
      {preset.kind === "diff" ? (
        // Keyed by language so each step remounts, as a new message would.
        <GenUIRenderer
          key={sample.id}
          data={{ block: buildLanguageDiffBlock(sample) as CodeDiffBlock }}
          messageId={`lab-code-diff-${sample.id}`}
        />
      ) : preset.kind === "fixture" ? (
        <GenUIRenderer data={{ block: fixture }} messageId="lab-code-diff" />
      ) : (
        <div className="ai-message prose dark:prose-invert max-w-full space-y-2 text-foreground">
          {/* Keyed by slide and language so each step remounts, as a new message would. */}
          <ChatMessageMarkdown
            key={`${preset.id}-${preset.kind === "snippet" ? sample.id : ""}`}
            content={preset.kind === "snippet" ? snippetMarkdown(sample) : (preset.markdown ?? "")}
            id={`lab-code-${preset.id}-${sample.id}`}
          />
        </div>
      )}
    </GenUiArrangementPauseZone>
  );
}

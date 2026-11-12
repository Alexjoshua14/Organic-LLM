"use client";

import {
  useGenUiArrangementCycle,
  type GenUiArrangement,
} from "../_hooks/use-gen-ui-arrangement-cycle";
import { useGenUiLanguageRotation } from "../_hooks/use-gen-ui-language-rotation";

import { GenUiArrangementPauseZone, GenUiArrangementToolbar } from "./GenUiArrangementToolbar";
import { GenUiLanguageControls } from "./GenUiLanguageControls";
import { LAB_LANGUAGE_IDS, LAB_LANGUAGES, sampleFor, snippetMarkdown } from "./lab-languages";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";

/**
 * The Code page is lab-only. Fenced code is not a Gen UI block: it is markdown in a chat reply,
 * rendered by the shared code block (`components/shared/code-block.tsx`). Like the Diagram page it
 * joins the gallery as an extra archetype id, and each preset is a real markdown message.
 */
export const LAB_CODE_ARCHETYPE = "code-block" as const;
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

type CodePreset = GenUiArrangement & {
  /** A complete assistant message, exactly as the chat renders it. */
  markdown: string;
};

export const LAB_CODE_PRESETS: ReadonlyArray<CodePreset> = [
  {
    id: "snippet",
    name: "Snippet",
    intent:
      "One real change per language, fenced as a model would. Pick a language or shuffle; short samples get no gutter.",
    markdown: snippetMarkdown(sampleFor(DEFAULT_LANGUAGE)),
  },
  {
    id: "reference",
    name: "Reference",
    intent:
      "A whole function you read top to bottom: line numbers, comments, types, indentation guides.",
    markdown: `Here is the complete module:\n\n${fence("ts", REFERENCE)}`,
  },
  {
    id: "command",
    name: "Command",
    intent: "Shell is for copying. One line, one clear Copy code.",
    markdown: `Install and run the unit tests:\n\n${fence("bash", "bun install\nbun run test:unit")}\n\nOr just one file:\n\n${fence("sh", "bun run test:unit tests/unit/foo.test.ts --verbose")}`,
  },
  {
    id: "long-lines",
    name: "Long lines",
    intent: "Lines wider than the column. Toggle wrap in the header; it starts as a scroll.",
    markdown: `These lines are wider than the chat column:\n\n${fence("ts", LONG_LINES)}`,
  },
  {
    id: "plain",
    name: "Plain",
    intent: "No language, or one we do not highlight. Same layout, no colors, still copyable.",
    markdown: `A fence with no language:\n\n${fence("", "plain output\n  indented line\nlast line")}\n\nAnd one we do not know:\n\n${fence("cobol", "IDENTIFICATION DIVISION.\nPROGRAM-ID. HELLO.")}`,
  },
  {
    id: "long-block",
    name: "Long block",
    intent: "Ninety lines, past the streaming threshold. Complete on mount, so it colors at once.",
    markdown: fence("ts", LONG_BLOCK),
  },
];

export function useGenUiCodeBlockDemo(active = true) {
  const cycle = useGenUiArrangementCycle(LAB_CODE_PRESETS, active);
  const onSnippet = cycle.index === 0;
  // The language only shows on the Snippet slide, so it rotates only while that slide is open.
  const rotation = useGenUiLanguageRotation(
    LAB_LANGUAGE_IDS,
    DEFAULT_LANGUAGE,
    active && onSnippet
  );

  return {
    ...cycle,
    rotation,
  };
}

type CodeBlockDemoState = ReturnType<typeof useGenUiCodeBlockDemo>;

export function GenUiCodeBlockDemoToolbar({ demo }: { demo: CodeBlockDemoState }) {
  return (
    <GenUiArrangementToolbar
      cycle={demo}
      extra={
        // The language only shows on the Snippet slide, so its controls live there. The row keeps
        // its height on other slides so the arrows and the preview never move.
        <div className="min-h-9">
          {demo.index === 0 ? (
            <GenUiLanguageControls languages={LAB_LANGUAGES} rotation={demo.rotation} />
          ) : null}
        </div>
      }
      groupLabel="Code presets"
      noun="preset"
    />
  );
}

/** Real markdown through the real chat renderer, inside chat's own prose wrapper. */
export function GenUiCodeBlockDemo({ demo }: { demo: CodeBlockDemoState }) {
  const preset = demo.arrangement;
  const sample = sampleFor(demo.rotation.language ?? DEFAULT_LANGUAGE);
  const onSnippet = demo.index === 0;
  const markdown = onSnippet ? snippetMarkdown(sample) : preset.markdown;

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
      <div className="ai-message prose dark:prose-invert max-w-full space-y-2 text-foreground">
        {/* Keyed by preset and language so each step remounts, as a new message would. */}
        <ChatMessageMarkdown
          key={`${preset.id}-${onSnippet ? sample.id : ""}`}
          content={markdown}
          id={`lab-code-${preset.id}-${sample.id}`}
        />
      </div>
    </GenUiArrangementPauseZone>
  );
}

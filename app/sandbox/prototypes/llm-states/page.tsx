"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";

import Link from "next/link";

import Page from "@/components/layout/page";
import {
  ChatLoading,
  ChatReasoning,
  ChatSearching,
  ChatThinking,
} from "@/components/chat/chat-loading";
import { ArcadiaToolResultCard, ChatAIAction } from "@/components/chat/chat-message";
import { FullChatHistoryToolResultCard } from "@/components/chat/full-chat-history-tool-result";
import {
  tryParseWebSearchToolOutput,
  WebSearchToolResultCard,
} from "@/components/chat/web-search-tool-result";
import { ChatAIActionEnum } from "@/types/ai";
import { glass } from "@/components/design-system/primitives";

const WRAPPER_CLASS = `rounded-lg p-4 mb-4 shadow-md ${glass()}`;

/** Matches the bordered wrapper around in-flight tool rows in `ChatMessage` / `AIMessage`. */
const INLINE_TOOL_ROW_CLASS =
  "not-prose rounded-lg border border-border/40 bg-background-tertiary/20 px-3 py-2";

const MOCK_WEB_SEARCH_BODY = {
  data: {
    results: [
      {
        id: "exa-1",
        title: "White hole - Wikipedia",
        url: "https://en.wikipedia.org/wiki/White_hole",
        highlights: [
          "A white hole is a hypothetical region of spacetime that cannot be entered from the outside.",
          "Matter and light can escape from it, unlike a black hole.",
        ],
        publishedDate: "2024-01-15T00:00:00.000Z",
        text: "Long body text is only used when highlights are missing; kept short here.",
      },
      {
        id: "exa-2",
        title: "Could white holes exist? | Example.org",
        url: "https://www.example.org/science/white-holes",
        highlights: ["Theoretical counterpart to black holes; none confirmed by observation."],
        publishedDate: "2023-11-02T00:00:00.000Z",
      },
    ],
  },
  error: null,
};

const MOCK_WEB_SEARCH_ERROR_BODY = {
  data: null,
  error: new Error("EXA_API_KEY missing or rate limited"),
};

const MOCK_WEB_SEARCH_PARSED = tryParseWebSearchToolOutput(MOCK_WEB_SEARCH_BODY)!;
const MOCK_WEB_SEARCH_ERROR_PARSED = tryParseWebSearchToolOutput(MOCK_WEB_SEARCH_ERROR_BODY)!;

/** Realistic search results for a “white holes” query — used across states. */
const WHITE_HOLES_SOURCES: ExaSearchResultSource[] = [
  {
    id: "nasa-wikipedia",
    title: "White hole - Wikipedia",
    url: "https://en.wikipedia.org/wiki/White_hole",
    snippet:
      "In general relativity, a white hole is a hypothetical region of spacetime that cannot be entered from the outside, although matter and light can escape from it.",
    author: "Wikipedia",
  },
  {
    id: "space-com",
    title: "What are white holes? | Space",
    url: "https://www.space.com/white-holes",
    snippet:
      "White holes are the theoretical opposite of black holes. They would spew matter and energy instead of trapping it—and they may not exist at all.",
    author: "Space.com",
  },
  {
    id: "scientific-american",
    title: "Could White Holes Exist? The Physics Says Maybe",
    url: "https://www.scientificamerican.com/article/white-holes",
    snippet:
      "If black holes absorb matter, white holes might expel it. No white hole has ever been observed, but they appear in solutions to Einstein's equations.",
  },
  {
    id: "physics-world",
    title: "White holes: the other side of a black hole – Physics World",
    url: "https://physicsworld.com/white-holes",
    snippet:
      "Some theorists argue that when a black hole forms, a white hole could form in a connected region of spacetime, effectively the other side of the collapse.",
  },
];

function StateBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </h2>
      <div className={WRAPPER_CLASS}>{children}</div>
    </section>
  );
}

export default function PrototypesLLMStatesPage() {
  return (
    <Page>
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:px-8 sm:py-16">
        <nav className="mb-12 sm:mb-16">
          <Link
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            href="/sandbox/prototypes"
          >
            ← Prototypes
          </Link>
        </nav>

        <header className="mb-14 sm:mb-20">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            LLM states
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            All chat loading and action states in one place. Sample flow: &ldquo;What are white
            holes?&rdquo; — use this to develop and compare styling without triggering real tool
            calls.
          </p>
        </header>

        <div className="space-y-1">
          <StateBlock label="ChatLoading (dots)">
            <ChatLoading />
          </StateBlock>

          <StateBlock label="ChatThinking — default">
            <ChatThinking />
          </StateBlock>

          <StateBlock label="ChatThinking — custom text">
            <ChatThinking text="Gathering context on white holes..." />
          </StateBlock>

          <StateBlock label="ChatThinking — Searching memories">
            <ChatThinking text="Searching memories for white holes..." />
          </StateBlock>

          <StateBlock label="ChatThinking — Using a tool">
            <ChatThinking text="Looking up white holes and general relativity..." />
          </StateBlock>

          <StateBlock label="ChatReasoning">
            <ChatReasoning />
          </StateBlock>

          <StateBlock label="ChatSearching — no sources yet">
            <ChatSearching text="Searching for white holes..." />
          </StateBlock>

          <StateBlock label="ChatSearching — with sources">
            <ChatSearching sources={WHITE_HOLES_SOURCES} text="Searching for white holes..." />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Processing}`}>
            <ChatThinking text="Gathering context on white holes..." />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Reasoning}`}>
            <ChatReasoning />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Search} (no sources)`}>
            <ChatSearching text="Searching for white holes..." />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Search} (with sources)`}>
            <ChatSearching sources={WHITE_HOLES_SOURCES} text="Searching for white holes..." />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Memory}`}>
            <ChatThinking text="Searching memories for white holes..." />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Tool}`}>
            <ChatThinking text="Looking up white holes and general relativity..." />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Typing}`}>
            <ChatThinking text="Writing up the answer..." />
          </StateBlock>

          <StateBlock label={`aiAction: ${ChatAIActionEnum.Errored}`}>
            <p className="text-sm text-destructive">
              Couldn&apos;t complete the search for white holes. Please try again.
            </p>
          </StateBlock>
        </div>

        <section className="mt-16 sm:mt-20">
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
            Tool call UI in the thread
          </h2>
          <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
            These are the pieces rendered inside assistant messages when tools run (ordered with
            streamed text), plus the optional ephemeral tail from{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">data-aiAction</code>. Loading
            primitives (<code className="rounded bg-muted px-1 py-0.5 text-xs">ChatThinking</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ChatSearching</code>, etc.) are
            listed above; here we focus on tool-specific chrome and the generic result card.
          </p>

          <div className="space-y-1">
            <StateBlock label="Tool in flight (inline row before result)">
              <p className="mb-3 text-xs text-muted-foreground">
                Bordered row with <code className="rounded bg-muted px-1">ChatThinking</code> and a
                label from the tool name (same pattern for AI SDK v5 tool parts and legacy
                tool-invocation).
              </p>
              <div className={INLINE_TOOL_ROW_CLASS}>
                <ChatThinking text="Searching the web..." />
              </div>
            </StateBlock>

            <StateBlock label="Ephemeral tail: ChatAIAction (data-aiAction)">
              <p className="mb-3 text-xs text-muted-foreground">
                Shown at the end of the streaming assistant message when side-channel events are
                not fully represented as message parts (e.g. Processing, Search with sources).
              </p>
              <ChatAIAction
                aiActionPayload={{
                  action: ChatAIActionEnum.Tool,
                  message: "Using tool: make_mermaid_diagram",
                }}
              />
            </StateBlock>

            <StateBlock label="Generic tool result — ArcadiaToolResultCard (JSON)">
              <p className="mb-3 text-xs text-muted-foreground">
                Default collapsible for tools without a dedicated card (pin, “View output”, raw
                JSON).
              </p>
              <ArcadiaToolResultCard
                displayBody={{
                  success: true,
                  query: "white holes",
                  count: 3,
                  memories: [{ memory: "User likes cosmology examples." }],
                }}
                isPinned={false}
                toolName="search_memories"
                onTogglePin={() => undefined}
              />
            </StateBlock>

            <StateBlock label="Generic tool result — ArcadiaToolResultCard (Mermaid in output)">
              <p className="mb-3 text-xs text-muted-foreground">
                When tool output includes Mermaid source, the generic card offers a diagram preview
                inside the details panel.
              </p>
              <ArcadiaToolResultCard
                displayBody={{
                  success: true,
                  code: "graph TD\n  A[User asks] --> B[Model answers]\n  B --> C[White holes]",
                }}
                isPinned={false}
                toolName="make_mermaid_diagram"
                onTogglePin={() => undefined}
              />
            </StateBlock>

            <StateBlock label="Search Results — WebSearchToolResultCard">
              <p className="mb-3 text-xs text-muted-foreground">
                Dedicated UI for <code className="rounded bg-muted px-1">web_search</code> tool
                output (parsed from Exa-style <code className="rounded bg-muted px-1">Result</code>
                ).
              </p>
              <WebSearchToolResultCard
                isPinned={false}
                parsed={MOCK_WEB_SEARCH_PARSED}
                onTogglePin={() => undefined}
              />
            </StateBlock>

            <StateBlock label="Search Results — error state">
              <WebSearchToolResultCard
                isPinned={false}
                parsed={MOCK_WEB_SEARCH_ERROR_PARSED}
                onTogglePin={() => undefined}
              />
            </StateBlock>

            <StateBlock label="Fetched full chat history — FullChatHistoryToolResultCard">
              <p className="mb-3 text-xs text-muted-foreground">
                Compact, non-collapsible summary for{" "}
                <code className="rounded bg-muted px-1">get_full_chat_history</code> (message count
                only; transcript stays in the scrollable thread).
              </p>
              <FullChatHistoryToolResultCard
                isPinned={false}
                parsed={{ kind: "ok", count: 28 }}
                onTogglePin={() => undefined}
              />
            </StateBlock>

            <StateBlock label="Fetched full chat history — error state">
              <FullChatHistoryToolResultCard
                isPinned={false}
                parsed={{ kind: "error", message: "Failed to load messages from the server." }}
                onTogglePin={() => undefined}
              />
            </StateBlock>
          </div>
        </section>

        <p className="mt-14 text-center text-xs text-muted-foreground sm:mt-20">
          Toggle light/dark to verify states in both themes.
        </p>
      </div>
    </Page>
  );
}

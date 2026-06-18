"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";

import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import {
  ChatLoading,
  ChatReasoning,
  ChatSearching,
  ChatThinking,
} from "@/components/chat/chat-loading";
import { ArcadiaToolResultCard, ChatAIAction } from "@/components/chat/chat-message";
import { FullChatHistoryToolResultCard } from "@/components/chat/full-chat-history-tool-result";
import { GetMoreChatHistoryToolResultCard } from "@/components/chat/get-more-chat-history-tool-result";
import {
  tryParseWebSearchToolOutput,
  WebSearchToolResultCard,
} from "@/components/chat/web-search-tool-result";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { ChatAIActionEnum } from "@/types/ai";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 mt-10 scroll-mt-4 text-sm font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h3>
  );
}

export default function PrototypesLLMStatesPage() {
  return (
    <Page className="items-stretch justify-start overflow-hidden">
      <div className="h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="4xl">
        <PageNavBack className="mb-12 sm:mb-16" href="/sandbox/prototypes">
          ← Prototypes
        </PageNavBack>

        <header className="mb-8 sm:mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            LLM states
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            All chat loading and action states in one place. Sample flow: &ldquo;What are white
            holes?&rdquo; — use this to develop and compare styling without triggering real tool
            calls.
          </p>
        </header>

        <Tabs className="w-full" defaultValue="primitives">
          <TabsList
            className={cn(
              "mb-8 flex h-auto min-h-9 w-full flex-wrap justify-start gap-1 sm:mb-10",
              "overflow-x-auto sm:flex-nowrap"
            )}
          >
            <TabsTrigger className="shrink-0" value="primitives">
              Primitives
            </TabsTrigger>
            <TabsTrigger className="shrink-0" value="ephemeral">
              Ephemeral tail
            </TabsTrigger>
            <TabsTrigger className="shrink-0" value="tools">
              Tool results
            </TabsTrigger>
          </TabsList>

          <TabsContent className="mt-0 space-y-0 focus-visible:ring-offset-0" value="primitives">
            <SectionTitle>Loading and thinking</SectionTitle>
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
            </div>

            <SectionTitle>Reasoning</SectionTitle>
            <div className="space-y-1">
              <StateBlock label="ChatReasoning">
                <ChatReasoning />
              </StateBlock>
            </div>

            <SectionTitle>Web search (loading UI)</SectionTitle>
            <div className="space-y-1">
              <StateBlock label="ChatSearching — no sources yet">
                <ChatSearching text="Searching for white holes..." />
              </StateBlock>

              <StateBlock label="ChatSearching — with sources">
                <ChatSearching sources={WHITE_HOLES_SOURCES} text="Searching for white holes..." />
              </StateBlock>
            </div>
          </TabsContent>

          <TabsContent className="mt-0 space-y-0 focus-visible:ring-offset-0" value="ephemeral">
            <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
              These mirror what{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">ChatAIAction</code> renders
              when the stream sends{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">data-aiAction</code> events
              (ephemeral tail on the streaming assistant message).
            </p>

            <SectionTitle>Processing and reasoning</SectionTitle>
            <div className="space-y-1">
              <StateBlock label={`aiAction: ${ChatAIActionEnum.Processing}`}>
                <ChatThinking text="Gathering context on white holes..." />
              </StateBlock>

              <StateBlock label={`aiAction: ${ChatAIActionEnum.Reasoning}`}>
                <ChatReasoning />
              </StateBlock>
            </div>

            <SectionTitle>Search and memory</SectionTitle>
            <div className="space-y-1">
              <StateBlock label={`aiAction: ${ChatAIActionEnum.Search} (no sources)`}>
                <ChatSearching text="Searching for white holes..." />
              </StateBlock>

              <StateBlock label={`aiAction: ${ChatAIActionEnum.Search} (with sources)`}>
                <ChatSearching sources={WHITE_HOLES_SOURCES} text="Searching for white holes..." />
              </StateBlock>

              <StateBlock label={`aiAction: ${ChatAIActionEnum.Memory}`}>
                <ChatThinking text="Searching memories for white holes..." />
              </StateBlock>
            </div>

            <SectionTitle>Tool, typing, and errors</SectionTitle>
            <div className="space-y-1">
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
          </TabsContent>

          <TabsContent className="mt-0 space-y-0 focus-visible:ring-offset-0" value="tools">
            <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
              UI rendered inside assistant messages when tools run (with streamed text), plus the
              generic collapsible where no dedicated card exists.
            </p>

            <SectionTitle>Inline and tail</SectionTitle>
            <div className="space-y-1">
              <StateBlock label="Tool in flight (inline row before result)">
                <p className="mb-3 text-xs text-muted-foreground">
                  Bordered row with <code className="rounded bg-muted px-1">ChatThinking</code> and
                  a label from the tool name (same pattern for AI SDK v5 tool parts and legacy
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
            </div>

            <SectionTitle>Generic and specialized cards</SectionTitle>
            <div className="space-y-1">
              <StateBlock label="Generic tool result — ArcadiaToolResultCard (JSON)">
                <p className="mb-3 text-xs text-muted-foreground">
                  Default inline row for tools without a dedicated card: muted one-line label, tap
                  to expand raw JSON (optional pin).
                </p>
                <ArcadiaToolResultCard
                  displayBody={{
                    status: "ok",
                    items: [{ id: 1 }, { id: 2 }],
                    note: "Prototype payload",
                  }}
                  isPinned={false}
                  toolName="example_custom_tool"
                  onTogglePin={() => undefined}
                />
              </StateBlock>

              <StateBlock label="Memory search — MemorySearchToolResultCard (via ArcadiaToolResultCard)">
                <p className="mb-3 text-xs text-muted-foreground">
                  <code className="rounded bg-muted px-1">search_memories</code>: title includes
                  count and truncated query; tap to expand memories.
                </p>
                <ArcadiaToolResultCard
                  displayBody={{
                    success: true,
                    query:
                      "What topics does the user enjoy discussing at length including astronomy and white holes",
                    count: 2,
                    memories: [
                      {
                        id: "m1",
                        memory: "User prefers cosmology analogies when learning new concepts.",
                        score: 0.912,
                      },
                      {
                        id: "m2",
                        memory: "User asked about white holes and general relativity before.",
                        score: 0.854,
                      },
                    ],
                  }}
                  isPinned={false}
                  toolName="search_memories"
                  onTogglePin={() => undefined}
                />
              </StateBlock>

              <StateBlock label="Memory search — error (flat)">
                <ArcadiaToolResultCard
                  displayBody={{
                    success: false,
                    query: "anything",
                    error: "Memory search rate limit exceeded.",
                    memories: [],
                    count: 0,
                  }}
                  isPinned={false}
                  toolName="search_memories"
                  onTogglePin={() => undefined}
                />
              </StateBlock>

              <StateBlock label="Mermaid diagram — MermaidToolAckCard (via ArcadiaToolResultCard)">
                <p className="mb-3 text-xs text-muted-foreground">
                  <code className="rounded bg-muted px-1">make_mermaid_diagram</code>: one-line
                  acknowledgment only; the diagram is meant to appear in the assistant markdown
                  message, not inside the tool card.
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

              <StateBlock label="Mermaid diagram — validation note (optional second line)">
                <ArcadiaToolResultCard
                  displayBody={{
                    success: true,
                    code: "graph TD\n  A-->B",
                    validationError:
                      "Server-side validator reported a minor issue; diagram may still render in the thread.",
                  }}
                  isPinned={false}
                  toolName="make_mermaid_diagram"
                  onTogglePin={() => undefined}
                />
              </StateBlock>

              <StateBlock label="Mermaid diagram — error (tool output-error string)">
                <ArcadiaToolResultCard
                  displayBody="Mermaid parse failed: unexpected token at line 4"
                  isPinned={false}
                  toolName="make_mermaid_diagram"
                  onTogglePin={() => undefined}
                />
              </StateBlock>
            </div>

            <SectionTitle>Web search and chat history</SectionTitle>
            <div className="space-y-1">
              <StateBlock label="Search Results — WebSearchToolResultCard">
                <p className="mb-3 text-xs text-muted-foreground">
                  Dedicated UI for <code className="rounded bg-muted px-1">web_search</code> tool
                  output (parsed from Exa-style{" "}
                  <code className="rounded bg-muted px-1">Result</code>
                  ).
                </p>
                <WebSearchToolResultCard
                  isPinned={false}
                  parsed={MOCK_WEB_SEARCH_PARSED}
                  onTogglePin={() => undefined}
                />
              </StateBlock>

              <StateBlock label="Search Results — error (inline)">
                <p className="mb-3 text-xs text-muted-foreground">
                  Same inline shell as other tool results: destructive summary line, tap to expand
                  message + pin.
                </p>
                <WebSearchToolResultCard
                  isPinned={false}
                  parsed={MOCK_WEB_SEARCH_ERROR_PARSED}
                  onTogglePin={() => undefined}
                />
              </StateBlock>

              <StateBlock label="Fetched full chat history — FullChatHistoryToolResultCard">
                <p className="mb-3 text-xs text-muted-foreground">
                  Inline ack for{" "}
                  <code className="rounded bg-muted px-1">get_full_chat_history</code>; tap to
                  expand message count (transcript stays in the scrollable thread).
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

              <StateBlock label="Additional chat history — GetMoreChatHistoryToolResultCard">
                <p className="mb-3 text-xs text-muted-foreground">
                  Minimal one-line ack for{" "}
                  <code className="rounded bg-muted px-1">get_more_chat_history</code>; tap to
                  expand context stats.
                </p>
                <GetMoreChatHistoryToolResultCard
                  parsed={{
                    kind: "ok",
                    count: 10,
                    messagesInContext: 31,
                    totalMessagesInThread: 50,
                  }}
                />
              </StateBlock>
            </div>
          </TabsContent>
        </Tabs>

        <p className="mt-14 text-center text-xs text-muted-foreground sm:mt-20">
          Toggle light/dark to verify states in both themes.
        </p>
        </PageContentFrame>
      </div>
    </Page>
  );
}

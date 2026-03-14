"use client";

import Link from "next/link";

import Page from "@/components/layout/page";
import {
  ChatLoading,
  ChatReasoning,
  ChatSearching,
  ChatThinking,
} from "@/components/chat/chat-loading";
import { ChatAIActionEnum } from "@/types/ai";
import type { ExaSearchResultSource } from "@/lib/exa/types";
import { glass } from "@/components/design-system/primitives";

const WRAPPER_CLASS =
  `rounded-lg p-4 mb-4 shadow-md ${glass()}`

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

function StateBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
            href="/sandbox/prototypes"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Prototypes
          </Link>
        </nav>

        <header className="mb-14 sm:mb-20">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            LLM states
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            All chat loading and action states in one place. Sample flow:
            &ldquo;What are white holes?&rdquo; — use this to develop and compare
            styling without triggering real tool calls.
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
            <ChatSearching
              text="Searching for white holes..."
              sources={WHITE_HOLES_SOURCES}
            />
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
            <ChatSearching
              text="Searching for white holes..."
              sources={WHITE_HOLES_SOURCES}
            />
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

        <p className="mt-14 text-center text-xs text-muted-foreground sm:mt-20">
          Toggle light/dark to verify states in both themes.
        </p>
      </div>
    </Page>
  );
}

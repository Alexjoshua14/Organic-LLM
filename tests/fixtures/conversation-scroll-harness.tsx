import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useStickToBottomContext } from "use-stick-to-bottom";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/third-party/ai-elements/conversation";

declare global {
  interface Window {
    scrollFixture: {
      append: () => void;
      growEarlier: () => void;
      collapseEarlier: () => void;
      resizeComposer: () => void;
      stream: () => void;
      switchThread: () => void;
    };
  }
}

const PARAGRAPH =
  "This is synthetic reading material for a scrolling regression. Keep the reader's place " +
  "while a conversation grows, and let deliberate navigation remain under the reader's control. ";

function FollowState() {
  const { isAtBottom } = useStickToBottomContext();

  return <output id="follow-state" data-at-bottom={String(isAtBottom)} />;
}

function Fixture() {
  const [extra, setExtra] = useState(0);
  const [earlierHeight, setEarlierHeight] = useState(0);
  const [tallComposer, setTallComposer] = useState(false);
  const [thread, setThread] = useState(0);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    window.scrollFixture = {
      append: () => setExtra((value) => value + 12),
      growEarlier: () => setEarlierHeight((value) => value + 180),
      collapseEarlier: () => setEarlierHeight(0),
      resizeComposer: () => setTallComposer((value) => !value),
      stream: () => setStreaming(true),
      switchThread: () => setThread((value) => value + 1),
    };
  }, []);

  useEffect(() => {
    if (!streaming) return;

    let ticks = 0;
    const timer = window.setInterval(() => {
      setExtra((value) => value + 1);
      ticks += 1;
      if (ticks === 20) setStreaming(false);
    }, 30);

    return () => window.clearInterval(timer);
  }, [streaming]);

  const options = new URLSearchParams(window.location.search);

  return (
    <main>
      <header>
        <h1>Conversation scrolling — synthetic fixture</h1>
        <span id="stream-state">{streaming ? "streaming" : "ready"}</span>
      </header>
      <Conversation
        key={thread}
        className="fixture-conversation"
        initial={options.get("initial") === "false" ? false : undefined}
        resize={options.get("resize") === "false" ? false : undefined}
      >
        <ConversationContent className="fixture-content">
          <div style={{ height: earlierHeight, flexShrink: 0 }} />
          {Array.from({ length: 30 + extra }, (_, index) => (
            <article key={index} data-paragraph={index}>
              <h2>Reading section {index + 1}</h2>
              <p>{PARAGRAPH.repeat(3)}</p>
            </article>
          ))}
          <div className="nested-reader" tabIndex={0} aria-label="Nested reading panel">
            {Array.from({ length: 12 }, (_, index) => (
              <p key={index}>{PARAGRAPH}</p>
            ))}
          </div>
        </ConversationContent>
        <FollowState />
        <ConversationScrollButton className="fixture-jump" />
      </Conversation>
      <footer style={{ height: tallComposer ? 180 : 64 }}>Synthetic composer</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);

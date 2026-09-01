import { describe, expect, test, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@/components/chat/chat-message", () => ({
  ChatMessage: ({ message }: { message: { parts?: Array<{ text?: string }> } }) => (
    <span>{message.parts?.[0]?.text ?? ""}</span>
  ),
}));

import { RabbitHoleDrawerChat } from "@/components/rabbit-holes/mobile/RabbitHoleDrawerChat";

describe("RabbitHoleDrawerChat", () => {
  test("renders empty prompt when no turns", () => {
    const html = renderToStaticMarkup(
      <RabbitHoleDrawerChat
        activeNode={null}
        branches={[]}
        canGoBack={false}
        chatId="chat-1"
        isBusy={false}
        messages={[]}
        session={null}
        sources={[]}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
        onSourceClick={() => undefined}
      />
    );

    expect(html).toContain("Ask a question to start the conversation");
  });

  test("renders tethered turn pair from messages", () => {
    const html = renderToStaticMarkup(
      <RabbitHoleDrawerChat
        activeNode={null}
        branches={[]}
        canGoBack={false}
        chatId="chat-1"
        isBusy={false}
        messages={[
          { id: "u1", role: "user", parts: [{ type: "text", text: "Hello drawer" }] },
          { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hi there" }] },
        ]}
        session={null}
        sources={[]}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
        onSourceClick={() => undefined}
      />
    );

    expect(html).toContain("Hello drawer");
    expect(html).toContain("Hi there");
  });
});

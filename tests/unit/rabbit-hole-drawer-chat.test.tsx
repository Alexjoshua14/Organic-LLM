import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { RabbitHoleDrawerChat } from "@/components/rabbit-holes/mobile/RabbitHoleDrawerChat";
import { TTSProvider } from "@/lib/context/tts-context";

function renderDrawerChat(ui: React.ReactNode) {
  return renderToStaticMarkup(<TTSProvider>{ui}</TTSProvider>);
}

describe("RabbitHoleDrawerChat", () => {
  test("renders empty prompt when no turns", () => {
    const html = renderDrawerChat(
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
    const html = renderDrawerChat(
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

  test("shows reading receipt while streaming before an assistant message exists", () => {
    const html = renderDrawerChat(
      <RabbitHoleDrawerChat
        activeNode={null}
        branches={[]}
        canGoBack={false}
        chatId="chat-1"
        isBusy={false}
        isStreaming
        messages={[{ id: "u1", role: "user", parts: [{ type: "text", text: "Hello drawer" }] }]}
        session={null}
        sources={[]}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
        onSourceClick={() => undefined}
      />
    );

    expect(html).toContain("Hello drawer");
    expect(html).toContain("Reading...");
  });
});

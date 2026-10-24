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
    expect(html).not.toContain("data-mesh-bar");
  });

  test("hides mesh bar when empty and budget utilization is low, and shows it when subagents are active", () => {
    const idleHtml = renderDrawerChat(
      <RabbitHoleDrawerChat
        activeNode={null}
        branches={[]}
        canGoBack={false}
        chatId="chat-1"
        isBusy={false}
        messages={[]}
        planBudget={{ spentUsd: 2.37, limitUsd: 25, canDispatch: true }}
        session={null}
        sources={[]}
        subagents={[]}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
        onSourceClick={() => undefined}
      />
    );

    expect(idleHtml).not.toContain("data-mesh-bar");

    const activeHtml = renderDrawerChat(
      <RabbitHoleDrawerChat
        activeNode={null}
        branches={[]}
        canGoBack={false}
        chatId="chat-1"
        isBusy={false}
        messages={[]}
        planBudget={{ spentUsd: 2.37, limitUsd: 25, canDispatch: true }}
        session={null}
        sources={[]}
        subagents={[{ name: "Lyra", role: "researcher", status: "working" }]}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
        onSourceClick={() => undefined}
      />
    );

    expect(activeHtml).toContain("data-mesh-bar");
    expect(activeHtml).toContain("Lyra");
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

  test("renders turn pair without nested overflow-y-auto scrollbars and includes turn navigation pills when multiple turns exist", () => {
    const html = renderDrawerChat(
      <RabbitHoleDrawerChat
        activeNode={null}
        branches={[]}
        canGoBack={false}
        chatId="chat-1"
        isBusy={false}
        messages={[
          { id: "u1", role: "user", parts: [{ type: "text", text: "First question" }] },
          { id: "a1", role: "assistant", parts: [{ type: "text", text: "First answer" }] },
          { id: "u2", role: "user", parts: [{ type: "text", text: "Second question" }] },
          { id: "a2", role: "assistant", parts: [{ type: "text", text: "Second answer" }] },
        ]}
        session={null}
        sources={[]}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
        onSourceClick={() => undefined}
      />
    );

    expect(html).toContain("Turn 2 / 2");
    expect(html).toContain("Previous turn");
    expect(html).toContain("Next turn");
    expect(html).not.toContain("overflow-y-auto");
  });
});

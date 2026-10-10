import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { UI_MESSAGE_STREAM_HEADERS, type UIMessageChunk } from "ai";
import { StrictMode, type ComponentProps } from "react";

import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

import * as coreInput from "@/components/chat/core-input";
import * as chatThread from "@/components/chat/chat-thread";
import * as arcadiaSettings from "@/components/chat/arcadia-chat-settings-dialog";
import * as threadStyle from "@/components/chat/chat-thread-style-overlay";
import * as diagramShell from "@/components/mermaid/diagram-takeover-shell";
import * as conversation from "@/components/third-party/ai-elements/conversation";
import { Chat } from "@/components/chat/chat";
import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";

const THREAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_THREAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let restore: Array<() => void>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

beforeEach(() => {
  // Keep the real Chat and AI SDK transport; isolate presentation and composer budget requests.
  restore = [
    mockModulePreservingReal("@/components/chat/core-input", coreInput, {
      CoreInput: ({ status, sendMessage }) => (
        <>
          <output data-testid="chat-status">{status}</output>
          <button type="button" onClick={() => void sendMessage({ text: "Diagnostic" })}>
            Send diagnostic
          </button>
        </>
      ),
    }),
    mockModulePreservingReal("@/components/chat/chat-thread", chatThread, {
      ChatThread: ({ messages }) => (
        <section data-testid="chat-messages">
          {messages.map((message) => (
            <div key={message.id} data-message-id={message.id}>
              {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
            </div>
          ))}
        </section>
      ),
    }),
    mockModulePreservingReal("@/components/chat/arcadia-chat-settings-dialog", arcadiaSettings, {
      ArcadiaChatSettingsDialog: () => null,
    }),
    mockModulePreservingReal("@/components/chat/chat-thread-style-overlay", threadStyle, {
      ChatThreadStyleOverlay: () => null,
    }),
    mockModulePreservingReal("@/components/mermaid/diagram-takeover-shell", diagramShell, {
      DiagramTakeoverShell: () => null,
    }),
    mockModulePreservingReal("@/components/third-party/ai-elements/conversation", conversation, {
      Conversation: ({ children }) => <div>{children}</div>,
      ConversationScrollButton: () => null,
    }),
  ];
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  for (const reset of restore.reverse()) reset();
});

function App({
  activeStreamId,
  threadId = THREAD_ID,
  experience,
}: {
  activeStreamId?: string | null;
  threadId?: string;
  experience?: "arcadia";
}) {
  const chatData: NonNullable<ComponentProps<typeof Chat>["chatData"]> = {
    thread: {
      id: threadId,
      active_stream_id: activeStreamId,
      created_at: "2026-10-09T00:00:00.000Z",
      updated_at: "2026-10-09T00:00:00.000Z",
    },
    messages: [],
  };

  return (
    <ChatContext.Provider value={{ refreshSidebarChats: () => {} } as ChatContextValue}>
      <Chat
        chatData={chatData}
        endpoint={experience === "arcadia" ? "/api/chat" : undefined}
        experience={experience}
      />
    </ChatContext.Provider>
  );
}

function liveStream(initialText: string, messageId = "assistant-test") {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const write = (chunk: UIMessageChunk) =>
    controller.enqueue(encoder.encode("data: " + JSON.stringify(chunk) + "\n\n"));
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      write({ type: "start", messageId });
      write({ type: "text-start", id: "answer" });
      write({ type: "text-delta", id: "answer", delta: initialText });
    },
  });

  return {
    response: new Response(body, { headers: UI_MESSAGE_STREAM_HEADERS }),
    append: (text: string) => write({ type: "text-delta", id: "answer", delta: text }),
    finish: () => {
      write({ type: "text-end", id: "answer" });
      write({ type: "finish", finishReason: "stop" });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  };
}

describe("Chat stream resumption on navigation", () => {
  test("the main chat posts to the canonical endpoint without a trailing-slash redirect", async () => {
    const stream = liveStream("New answer");

    fetchSpy.mockImplementation(async (_url, options) =>
      options?.method === "POST" ? stream.response : new Response(null, { status: 204 })
    );
    const view = render(<App activeStreamId={null} />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        (view.getByRole("button", { name: "Send diagnostic" }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
    fireEvent.click(view.getByRole("button", { name: "Send diagnostic" }));
    await waitFor(() =>
      expect(view.getByTestId("chat-messages").textContent).toBe("DiagnosticNew answer")
    );
    await act(async () => stream.finish());
    await waitFor(() => expect(view.getByTestId("chat-status").textContent).toBe("ready"));
    expect(
      fetchSpy.mock.calls
        .filter(([, options]) => options?.method === "POST")
        .map(([url]) => String(url))
    ).toEqual(["/api/chat"]);
  });

  test("a fresh 204 leaves an inactive thread ready, including Strict Mode mounts", async () => {
    const view = render(
      <StrictMode>
        <App activeStreamId={null} />
      </StrictMode>
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await act(async () => {});
    expect(view.getByTestId("chat-status").textContent).toBe("ready");
    expect(view.getByTestId("chat-messages").textContent).toBe("");
    for (const [url, options] of fetchSpy.mock.calls) {
      expect(String(url)).toBe("/api/chat/" + THREAD_ID + "/stream");
      expect(options?.method).toBe("GET");
    }
  });

  test.each([
    ["Chat", undefined],
    ["Arcadia", "arcadia"],
  ] as const)(
    "%s reconnects and consumes live chunks despite a stale null active-stream snapshot",
    async (_label, experience) => {
      const stream = liveStream("Already generated");

      fetchSpy.mockResolvedValueOnce(stream.response);
      const view = render(<App activeStreamId={null} experience={experience} />);

      await waitFor(() => {
        expect(view.getByTestId("chat-messages").textContent).toBe("Already generated");
        expect(view.getByTestId("chat-status").textContent).toBe("streaming");
      });
      await act(async () => stream.append(" and still streaming"));
      await waitFor(() =>
        expect(view.getByTestId("chat-messages").textContent).toBe(
          "Already generated and still streaming"
        )
      );
      await act(async () => stream.finish());
      await waitFor(() => expect(view.getByTestId("chat-status").textContent).toBe("ready"));
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("/api/chat/" + THREAD_ID + "/stream");
      expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe("GET");
    }
  );

  test.each([
    ["missing", undefined],
    ["present", "stream-test"],
  ] as const)("resumes when the page active-stream field is %s", async (_label, activeStreamId) => {
    const stream = liveStream("Resumed answer");

    fetchSpy.mockResolvedValueOnce(stream.response);
    const view = render(<App activeStreamId={activeStreamId} />);

    await waitFor(() =>
      expect(view.getByTestId("chat-messages").textContent).toBe("Resumed answer")
    );
    await act(async () => stream.finish());
    await waitFor(() => expect(view.getByTestId("chat-status").textContent).toBe("ready"));
  });

  test("leaving and returning to an active Arcadia thread reconnects with a cached null snapshot", async () => {
    const first = liveStream("First part");
    const resumed = liveStream("First part, generated while away");

    fetchSpy
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(first.response)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(resumed.response);
    const view = render(
      <App threadId={OTHER_THREAD_ID} activeStreamId={null} experience="arcadia" />
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    view.rerender(<App activeStreamId={null} experience="arcadia" />);
    await waitFor(() => expect(view.getByTestId("chat-messages").textContent).toBe("First part"));
    const firstSignal = fetchSpy.mock.calls[1]?.[1]?.signal;

    view.rerender(<App threadId={OTHER_THREAD_ID} activeStreamId={null} experience="arcadia" />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    expect(firstSignal?.aborted).toBe(true);
    expect(view.getByTestId("chat-messages").textContent).toBe("");

    view.rerender(<App activeStreamId={null} experience="arcadia" />);
    await waitFor(() =>
      expect(view.getByTestId("chat-messages").textContent).toBe("First part, generated while away")
    );
    expect(view.getByTestId("chat-status").textContent).toBe("streaming");
    expect(view.getByTestId("chat-messages").children).toHaveLength(1);
    await act(async () => resumed.append(", and after returning"));
    await waitFor(() =>
      expect(view.getByTestId("chat-messages").textContent).toBe(
        "First part, generated while away, and after returning"
      )
    );
    await act(async () => resumed.finish());
    await waitFor(() => expect(view.getByTestId("chat-status").textContent).toBe("ready"));
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/chat/" + OTHER_THREAD_ID + "/stream",
      "/api/chat/" + THREAD_ID + "/stream",
      "/api/chat/" + OTHER_THREAD_ID + "/stream",
      "/api/chat/" + THREAD_ID + "/stream",
    ]);
  });
});

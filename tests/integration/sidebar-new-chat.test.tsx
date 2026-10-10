import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";

import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";
import * as sidebarUi from "@/components/third-party/ui/sidebar";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

const mockCreateChat = mock<() => Promise<{ data: string | null; error: Error | null }>>(
  async () => ({
    data: "new-chat-id",
    error: null,
  })
);
const mockRefreshSidebarChats = mock(() => {});
const mockRouterPush = mock(() => {});
const mockCreateArcadia = mock(async () => ({ ok: true, path: "/sandbox/arcadia/new-arcadia-id" }));

mock.module("@/lib/chat/create-arcadia-thread", () => ({
  createArcadiaThreadAction: mockCreateArcadia,
}));

const chatStoreStub = async () => ({ data: null, error: new Error("chat-store mocked") });
mock.module("@/lib/chat/chat-store", () => ({
  createChat: mockCreateChat,
  loadChat: chatStoreStub,
  readChat: chatStoreStub,
  saveChat: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  saveMessage: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  deleteChatMessage: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  getChats: async () => ({ data: null, error: new Error("chat-store mocked") }),
  getChat: chatStoreStub,
  getContext: async () => ({ data: null, error: "chat-store mocked" }),
  getContextAndMessagesChatPrompt: async () => ({ data: null, error: "chat-store mocked" }),
  getMessagesForChatPrompt: async () => ({ data: null, error: "chat-store mocked" }),
}));

mock.module("server-only", () => ({}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/chat",
}));

mock.module("next/link", () => ({
  default: ({ children, href, ...p }: { children?: ReactNode; href: string }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

// Merged over the real module and restored: a bare stub dropped `SidebarProvider` and the
// other primitives for every file loaded after this one.
const restoreSidebarUi = mockModulePreservingReal(
  "@/components/third-party/ui/sidebar",
  sidebarUi,
  {
    SidebarMenuButton: ({
      children,
      onClick,
      ...props
    }: ComponentProps<"button"> & { children?: ReactNode }) => (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    ),
  } as never
);

afterAll(restoreSidebarUi);

import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";

describe("SidebarExperienceRail (Chat segment)", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    mockCreateChat.mockClear();
    mockRefreshSidebarChats.mockClear();
    mockRouterPush.mockClear();
    mockCreateArcadia.mockClear();
    mockCreateArcadia.mockResolvedValue({ ok: true, path: "/sandbox/arcadia/new-arcadia-id" });

    mockCreateChat.mockResolvedValue({
      data: "new-chat-id",
      error: null,
    });
  });

  async function renderNewChat() {
    const { SidebarExperienceRail } = await import("@/components/sidebar/sidebar-experience-rail");

    return render(
      <FeatureHintRegistryProvider>
        <ChatContext.Provider
          value={
            {
              chat: {} as ChatContextValue["chat"],
              clearChat: () => {},
              setChatId: () => {},
              chatId: "",
              sidebarChats: [],
              isSidebarChatsLoading: false,
              sidebarChatsError: null,
              refreshSidebarChats: mockRefreshSidebarChats,
            } as ChatContextValue
          }
        >
          <SidebarExperienceRail />
        </ChatContext.Provider>
      </FeatureHintRegistryProvider>
    );
  }

  test("creates a chat, refreshes the sidebar list, and routes to the new chat", async () => {
    const user = userEvent.setup({ document: globalThis.document });
    const view = await renderNewChat();

    await user.click(view.getByText("Chat"));

    expect(mockCreateChat.mock.calls.length).toBe(1);
    expect(mockRefreshSidebarChats.mock.calls.length).toBe(1);
    expect(mockRouterPush.mock.calls.length).toBe(1);
    expect((mockRouterPush.mock.calls[0] as string[])[0]).toBe("/chat/new-chat-id");
  });

  test("does not refresh or route when chat creation fails", async () => {
    mockCreateChat.mockResolvedValueOnce({
      data: null,
      error: new Error("failed"),
    });

    const user = userEvent.setup({ document: globalThis.document });
    const view = await renderNewChat();

    await user.click(view.getByText("Chat"));

    expect(mockRefreshSidebarChats.mock.calls.length).toBe(0);
    expect(mockRouterPush.mock.calls.length).toBe(0);
  });

  test("Arcadia creates on click and navigates directly to the canonical thread", async () => {
    const user = userEvent.setup({ document: globalThis.document });
    const view = await renderNewChat();

    expect(mockCreateArcadia).not.toHaveBeenCalled();
    await user.click(view.getByRole("button", { name: "Arcadia" }));

    expect(mockCreateArcadia).toHaveBeenCalledTimes(1);
    expect(mockCreateChat).not.toHaveBeenCalled();
    expect(mockRefreshSidebarChats).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/sandbox/arcadia/new-arcadia-id");
  });

  test("pending creation blocks repeat clicks and other new-thread actions", async () => {
    let resolve!: (value: { ok: boolean; path: string }) => void;

    mockCreateArcadia.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const user = userEvent.setup({ document: globalThis.document });
    const view = await renderNewChat();

    await user.click(view.getByRole("button", { name: "Arcadia" }));
    await user.click(view.getByRole("button", { name: "Arcadia" }));
    await user.click(view.getByRole("button", { name: "Chat" }));
    expect(mockCreateArcadia).toHaveBeenCalledTimes(1);
    expect(mockCreateChat).not.toHaveBeenCalled();
    await act(async () => resolve({ ok: true, path: "/sandbox/arcadia/new-arcadia-id" }));
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";

import { render } from "../helpers/render";

const mockCreateChat = mock(async () => ({
  data: "new-chat-id",
  error: null,
}));
const mockRefreshSidebarChats = mock(() => {});
const mockRouterPush = mock(() => {});

mock.module("@/lib/chat/chat-store", () => ({
  createChat: mockCreateChat,
}));

mock.module("server-only", () => ({}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

mock.module("@/components/third-party/ui/sidebar", () => ({
  SidebarMenuButton: ({
    children,
    onClick,
    ...props
  }: ComponentProps<"button"> & { children?: ReactNode }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";

describe("SidebarNewChat", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    mockCreateChat.mockReset();
    mockRefreshSidebarChats.mockReset();
    mockRouterPush.mockReset();

    mockCreateChat.mockResolvedValue({
      data: "new-chat-id",
      error: null,
    });
  });

  async function renderNewChat() {
    const { SidebarNewChat } = await import(
      "@/components/sidebar/sidebar-new-chat"
    );

    return render(
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
        <SidebarNewChat />
      </ChatContext.Provider>,
    );
  }

  test("creates a chat, refreshes the sidebar list, and routes to the new chat", async () => {
    const user = userEvent.setup({ document: globalThis.document });
    const view = await renderNewChat();

    await user.click(view.getByText("New Chat"));

    expect(mockCreateChat).toHaveBeenCalled();
    expect(mockRefreshSidebarChats).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith("/chat/new-chat-id");
  });

  test("does not refresh or route when chat creation fails", async () => {
    mockCreateChat.mockResolvedValueOnce({
      data: null,
      error: new Error("failed"),
    });

    const user = userEvent.setup({ document: globalThis.document });
    const view = await renderNewChat();

    await user.click(view.getByText("New Chat"));

    expect(mockRefreshSidebarChats).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});

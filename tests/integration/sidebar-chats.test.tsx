import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup } from "@testing-library/react";

import { render } from "../helpers/render";

const mockRouterPush = mock(() => {});

mock.module("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/",
}));

mock.module("@/hooks/use-chat-id", () => ({
  useChatId: () => null,
}));

mock.module("@/data/supabase/chat", () => ({
  updateChatTitle: mock(async () => ({ ok: true, error: null })),
  updateChatPinned: mock(async () => ({ ok: true, error: null })),
  deleteChat: mock(async () => ({ ok: true, error: null })),
}));

import { SidebarProvider } from "@/components/third-party/ui/sidebar";
import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";
import { SidebarChats } from "@/components/sidebar/sidebar-chats";

describe("SidebarChats", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    mockRouterPush.mockReset();
  });

  function renderSidebarChats(value: Partial<ChatContextValue>) {
    return render(
      <ChatContext.Provider value={value as ChatContextValue}>
        <SidebarProvider>
          <SidebarChats />
        </SidebarProvider>
      </ChatContext.Provider>,
    );
  }

  test("shows a loading state when chats are still loading", () => {
    const view = renderSidebarChats({
      sidebarChats: [],
      isSidebarChatsLoading: true,
      setChatId: mock(() => {}),
      refreshSidebarChats: mock(() => {}),
    });

    expect(view.getByText("Loading threads…")).toBeDefined();
  });

  test("renders pinned chats separately from all threads", () => {
    const view = renderSidebarChats({
      sidebarChats: [
        {
          id: "thread-pinned",
          title: "Pinned Chat",
          pinned: true,
          date: "2026-03-08T01:00:00.000Z",
        },
        {
          id: "thread-regular",
          title: "Regular Chat",
          pinned: false,
          date: "2026-03-08T02:00:00.000Z",
        },
      ],
      isSidebarChatsLoading: false,
      setChatId: mock(() => {}),
      refreshSidebarChats: mock(() => {}),
    });

    expect(view.getByText("Pinned")).toBeDefined();
    expect(view.getByText("All Threads")).toBeDefined();
    expect(view.getAllByText("Pinned Chat")).toHaveLength(1);
    expect(view.getAllByText("Regular Chat")).toHaveLength(1);
  });
});

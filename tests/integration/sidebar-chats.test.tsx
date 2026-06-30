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
import { MEMORY_INGEST_FEATURE } from "@/lib/chat/memory-ingest";
import { USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";
import { defaultUserSettings } from "@/lib/schemas/userSettings";

describe("SidebarChats", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
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

  test("excludes memory-ingest sessions from the sidebar even in coalescence mode", () => {
    // Coalescence mode surfaces every feature in the list (e.g. Arcadia); the
    // Memory ingest chamber is the one exception and must never appear here.
    localStorage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...defaultUserSettings(), coalescenceMode: true }),
    );

    const view = renderSidebarChats({
      sidebarChats: [
        {
          id: "thread-main",
          title: "Main Chat",
          pinned: false,
          date: "2026-03-08T01:00:00.000Z",
          feature: "main",
        },
        {
          id: "thread-arcadia",
          title: "Arcadia Chat",
          pinned: false,
          date: "2026-03-08T02:00:00.000Z",
          feature: "arcadia",
        },
        {
          id: "thread-memory",
          title: "Memory Session",
          pinned: false,
          date: "2026-03-08T03:00:00.000Z",
          feature: MEMORY_INGEST_FEATURE,
        },
      ],
      isSidebarChatsLoading: false,
      setChatId: mock(() => {}),
      refreshSidebarChats: mock(() => {}),
    });

    expect(view.getAllByText("Main Chat")).toHaveLength(1);
    expect(view.getAllByText("Arcadia Chat")).toHaveLength(1);
    expect(view.queryByText("Memory Session")).toBeNull();
  });
});

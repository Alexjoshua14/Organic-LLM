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

import { defaultUserSettings } from "@/lib/schemas/userSettings";

const USER_SETTINGS_STORAGE_KEY = "organic-llm-user-settings";

mock.module("@/lib/user-settings", () => ({
  USER_SETTINGS_STORAGE_KEY,
  getSettings: () => {
    if (typeof localStorage === "undefined") return defaultUserSettings();

    const stored = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!stored) return defaultUserSettings();

    try {
      return { ...defaultUserSettings(), ...JSON.parse(stored) };
    } catch {
      return defaultUserSettings();
    }
  },
  // Bun module mocks are process-wide; other files import composer code that needs this export.
  setSettings: () => defaultUserSettings(),
}));

import { SidebarProvider } from "@/components/third-party/ui/sidebar";
import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";
import { SidebarChats } from "@/components/sidebar/sidebar-chats";

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

  const baseValue = {
    sidebarChats: [],
    sidebarPinnedChats: [],
    sidebarUnpinnedChats: [],
    isSidebarChatsLoading: false,
    isSidebarChatsLoadingMore: false,
    hasMoreSidebarChats: false,
    loadMoreSidebarChats: mock(() => {}),
    setChatId: mock(() => {}),
    refreshSidebarChats: mock(() => {}),
  } satisfies Partial<ChatContextValue>;

  test("shows a loading state when chats are still loading", () => {
    const view = renderSidebarChats({ ...baseValue, isSidebarChatsLoading: true });

    expect(view.getByText("Loading threads…")).toBeDefined();
  });

  test("renders pinned chats separately from all threads", () => {
    const view = renderSidebarChats({
      ...baseValue,
      sidebarPinnedChats: [
        { id: "thread-pinned", title: "Pinned Chat", pinned: true, date: "2026-03-08T01:00:00.000Z" },
      ],
      sidebarUnpinnedChats: [
        { id: "thread-regular", title: "Regular Chat", pinned: false, date: "2026-03-08T02:00:00.000Z" },
      ],
    });

    expect(view.getByText("Pinned")).toBeDefined();
    expect(view.getByText("All Threads")).toBeDefined();
    expect(view.getAllByText("Pinned Chat")).toHaveLength(1);
    expect(view.getAllByText("Regular Chat")).toHaveLength(1);
  });

  test("renders the server-filtered list as given (scope filtering is server-side)", () => {
    const view = renderSidebarChats({
      ...baseValue,
      sidebarUnpinnedChats: [
        { id: "thread-arcadia", title: "Arcadia Chat", pinned: false, date: "2026-03-08T02:00:00.000Z", feature: "arcadia" },
      ],
    });

    expect(view.getAllByText("Arcadia Chat")).toHaveLength(1);
  });

  test("loads the next page when the end of the list scrolls into view", () => {
    const loadMore = mock(() => {});
    const observers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit }> = [];
    const original = globalThis.IntersectionObserver;

    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observers.push({ callback, options });
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;

    try {
      const view = renderSidebarChats({
        ...baseValue,
        sidebarUnpinnedChats: [
          { id: "thread-1", title: "Thread", pinned: false, date: "2026-03-08T02:00:00.000Z" },
        ],
        hasMoreSidebarChats: true,
        isSidebarChatsLoadingMore: true,
        loadMoreSidebarChats: loadMore,
      });

      expect(view.getByText("Loading older threads…")).toBeDefined();
      expect(observers).toHaveLength(1);

      observers[0]!.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );

      expect(loadMore).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.IntersectionObserver = original;
    }
  });
});

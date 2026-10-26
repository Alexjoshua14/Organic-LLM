import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

import * as sidebarActivity from "@/hooks/use-sidebar-activity";
import type { SidebarThreadActivity } from "@/lib/sidebar/session-signal";

const mockRouterPush = mock(() => {});
const mockMarkSeen = mock(async () => {});
const mockRevalidateActivity = mock(() => {});
let currentActivity: SidebarThreadActivity[] = [];
let currentChatId: string | null = null;

const restoreSidebarActivity = mockModulePreservingReal(
  "@/hooks/use-sidebar-activity",
  sidebarActivity,
  {
    useSidebarActivity: () => ({
      activityById: new Map(currentActivity.map((row) => [row.id, row])),
      markSeen: mockMarkSeen,
      revalidateActivity: mockRevalidateActivity,
    }),
  }
);

afterAll(restoreSidebarActivity);

mock.module("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

mock.module("@/hooks/use-chat-id", () => ({
  useChatId: () => currentChatId,
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
    mockMarkSeen.mockReset();
    mockRevalidateActivity.mockReset();
    currentActivity = [];
    currentChatId = null;
  });

  function renderSidebarChats(value: Partial<ChatContextValue>) {
    return render(
      <ChatContext.Provider value={value as ChatContextValue}>
        <SidebarProvider>
          <SidebarChats />
        </SidebarProvider>
      </ChatContext.Provider>
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

    expect(view.getByRole("status", { name: "Loading threads" })).toBeDefined();
    expect(view.getByText("All Threads")).toBeDefined();
  });

  test("renders pinned chats separately from all threads", () => {
    const view = renderSidebarChats({
      ...baseValue,
      sidebarPinnedChats: [
        {
          id: "thread-pinned",
          title: "Pinned Chat",
          pinned: true,
          date: "2026-03-08T01:00:00.000Z",
        },
      ],
      sidebarUnpinnedChats: [
        {
          id: "thread-regular",
          title: "Regular Chat",
          pinned: false,
          date: "2026-03-08T02:00:00.000Z",
        },
      ],
    });

    expect(view.getByText("Pinned")).toBeDefined();
    expect(view.getByText("All Threads")).toBeDefined();
    // Count actionable rows, not both the visual title and its screen-reader copy.
    expect(view.getAllByRole("button", { name: "Open Pinned Chat" })).toHaveLength(1);
    expect(view.getAllByRole("button", { name: "Open Regular Chat" })).toHaveLength(1);
  });

  test("renders the server-filtered list as given (scope filtering is server-side)", () => {
    const view = renderSidebarChats({
      ...baseValue,
      sidebarUnpinnedChats: [
        {
          id: "thread-arcadia",
          title: "Arcadia Chat",
          pinned: false,
          date: "2026-03-08T02:00:00.000Z",
          feature: "arcadia",
        },
      ],
    });

    expect(view.getAllByRole("button", { name: "Open Arcadia Chat" })).toHaveLength(1);
  });

  test("loads the next page when the end of the list scrolls into view", () => {
    const loadMore = mock(() => {});
    const observers: Array<{
      callback: IntersectionObserverCallback;
      options?: IntersectionObserverInit;
    }> = [];
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

      expect(view.getByRole("button", { name: "Open Thread" })).toBeDefined();
      expect(view.queryByRole("status", { name: "Loading threads" })).toBeNull();
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

  describe("session signals", () => {
    const threads = [
      {
        id: "thread-main",
        title: "Main Chat",
        pinned: false,
        date: "2026-03-08T01:00:00.000Z",
        feature: "main",
      },
      {
        id: "thread-hole",
        title: "Rome",
        pinned: false,
        date: "2026-03-08T02:00:00.000Z",
        feature: "rabbit_hole",
        href: "/rabbitholes?sessionId=abc",
      },
      {
        id: "thread-speak",
        title: "Kitchen call",
        pinned: false,
        date: "2026-03-08T03:00:00.000Z",
        feature: "speak",
        href: "/speak",
      },
    ];

    function renderWithSignals() {
      localStorage.setItem(
        USER_SETTINGS_STORAGE_KEY,
        JSON.stringify({ ...defaultUserSettings(), coalescenceMode: true })
      );

      return renderSidebarChats({
        ...baseValue,
        sidebarChats: threads,
        sidebarUnpinnedChats: threads,
        isSidebarChatsLoading: false,
        setChatId: mock(() => {}),
        refreshSidebarChats: mock(() => {}),
      });
    }

    const signalOf = (view: ReturnType<typeof renderWithSignals>, id: string) =>
      view.container
        .querySelector(`[data-sidebar-thread="${id}"]`)
        ?.getAttribute("data-session-signal");

    test("lights new rows, shows working rows, and summarises both in the list header", () => {
      currentActivity = [
        { id: "thread-main", unseen: true, working: null },
        { id: "thread-hole", unseen: false, working: { step: "sources" } },
      ];

      const view = renderWithSignals();

      expect(signalOf(view, "thread-main")).toBe("new");
      expect(signalOf(view, "thread-hole")).toBe("working");
      expect(view.getByText("Finding sources")).toBeDefined();
      expect(view.getByText("1 working")).toBeDefined();
      expect(view.getByText("1 new")).toBeDefined();
      expect(mockMarkSeen).not.toHaveBeenCalled();
    });

    test("jumping to new focuses the lit row", () => {
      currentActivity = [{ id: "thread-main", unseen: true, working: null }];

      const view = renderWithSignals();

      fireEvent.click(view.getByText("1 new"));

      expect(document.activeElement?.getAttribute("aria-label")).toBe("Open Main Chat");
    });

    test("the open thread in a visible tab is marked seen instead of shown as new", async () => {
      currentActivity = [{ id: "thread-main", unseen: true, working: null }];
      currentChatId = "thread-main";
      // jsdom reports a hidden document unless told otherwise.
      Object.defineProperty(document, "hidden", { configurable: true, value: false });

      try {
        const view = renderWithSignals();

        expect(signalOf(view, "thread-main")).toBe("idle");
        await waitFor(() => expect(mockMarkSeen).toHaveBeenCalledWith("thread-main"));
      } finally {
        delete (document as { hidden?: boolean }).hidden;
      }
    });

    test("a hidden tab does not mark the open thread seen", () => {
      currentActivity = [{ id: "thread-main", unseen: true, working: null }];
      currentChatId = "thread-main";
      Object.defineProperty(document, "hidden", { configurable: true, value: true });

      try {
        renderWithSignals();

        expect(mockMarkSeen).not.toHaveBeenCalled();
      } finally {
        delete (document as { hidden?: boolean }).hidden;
      }
    });

    test("Speak is never new — voice is realtime", () => {
      currentActivity = [{ id: "thread-speak", unseen: true, working: null }];

      const view = renderWithSignals();

      expect(signalOf(view, "thread-speak")).toBe("idle");
      expect(view.queryByText("1 new")).toBeNull();
    });
  });
});

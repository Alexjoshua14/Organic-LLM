import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

const mockDeleteChat = mock(async () => ({ ok: true, error: null }));
const mockRefreshSidebarChats = mock(() => {});
const mockBeginTitleRegen = mock(() => {});
const mockResolveTitleRegen = mock(() => {});
const mockFinishTitleRegen = mock(() => {});
const mockIsTitleRegenerating = mock((_id: string) => false);
const mockRouterPush = mock(() => {});
const mockOnOpenChange = mock(() => {});

let currentPathname = "/";
let fetchImpl: typeof fetch = async () => new Response(null, { status: 500 });

mock.module("@/data/supabase/chat", () => ({
  deleteChat: mockDeleteChat,
}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => currentPathname,
}));

const originalFetch = globalThis.fetch;

mock.module("@/components/third-party/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    className,
    disabled,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button className={className} disabled={disabled} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

mock.module("@heroui/modal", () => {
  const React = require("react") as typeof import("react");

  return {
    useDisclosure: () => {
      const [isOpen, setIsOpen] = React.useState(false);
      return {
        isOpen,
        onOpen: () => setIsOpen(true),
        onClose: () => setIsOpen(false),
        onOpenChange: (open: boolean) => setIsOpen(open),
      };
    },
    Modal: ({
      children,
      isOpen,
    }: {
      children: ReactNode;
      isOpen: boolean;
    }) => (isOpen ? <div>{children}</div> : null),
    ModalContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ModalHeader: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

mock.module("@heroui/button", () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress?: () => void;
  }) => <button onClick={() => onPress?.()}>{children}</button>,
}));

import { SidebarThreadActionsMenu } from "@/components/sidebar/sidebar-thread-actions-menu";
import { resetTitleRegenStore, startTitleRegen } from "@/lib/chat/title-regen-store";
import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";

const thread = {
  id: "thread-1",
  title: "Thread One",
  pinned: false,
  date: "2026-03-08T01:00:00.000Z",
};

describe("SidebarThreadActionsMenu", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    mockDeleteChat.mockReset();
    mockRefreshSidebarChats.mockReset();
    mockBeginTitleRegen.mockReset();
    mockResolveTitleRegen.mockReset();
    mockFinishTitleRegen.mockReset();
    mockIsTitleRegenerating.mockReset();
    mockRouterPush.mockReset();
    mockOnOpenChange.mockReset();
    mockDeleteChat.mockResolvedValue({ ok: true, error: null });
    resetTitleRegenStore();
    mockIsTitleRegenerating.mockImplementation(() => false);
    currentPathname = "/";
    fetchImpl = async () =>
      new Response(JSON.stringify({ data: "Fresh Title" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => fetchImpl(...args)) as typeof fetch;
  });

  function renderMenu() {
    return render(
      <ChatContext.Provider
        value={
          {
            chat: {} as ChatContextValue["chat"],
            clearChat: () => {},
            setChatId: () => {},
            chatId: "",
            sidebarChats: [thread],
            isSidebarChatsLoading: false,
            sidebarChatsError: null,
            refreshSidebarChats: mockRefreshSidebarChats,
            titleRegenThreadIds: new Set(),
            isTitleRegenerating: mockIsTitleRegenerating,
            getTitleRegenBurnText: (_id: string, fallback: string) => fallback,
            beginTitleRegen: mockBeginTitleRegen,
            resolveTitleRegen: mockResolveTitleRegen,
            isTitleRegenReadyToCommit: () => false,
            finishTitleRegen: mockFinishTitleRegen,
          } as ChatContextValue
        }
      >
        <SidebarThreadActionsMenu
          thread={thread}
          open={true}
          onOpenChange={mockOnOpenChange}
          onEditTitle={() => {}}
          onTogglePin={() => {}}
        >
          <button>Open menu</button>
        </SidebarThreadActionsMenu>
      </ChatContext.Provider>,
    );
  }

  test("deletes the active thread, refreshes chats, and redirects home", async () => {
    currentPathname = "/chat/thread-1";
    const view = renderMenu();

    fireEvent.click(view.getAllByText("Delete thread")[0]!);
    fireEvent.click(view.getByText("Delete"));

    await waitFor(() => {
      expect(mockDeleteChat).toHaveBeenCalledWith("thread-1");
      expect(mockRefreshSidebarChats).toHaveBeenCalled();
      expect(mockRouterPush).toHaveBeenCalledWith("/");
    });
  });

  test("deletes an inactive thread without redirecting", async () => {
    currentPathname = "/chat/other-thread";
    const view = renderMenu();

    fireEvent.click(view.getAllByText("Delete thread")[0]!);
    fireEvent.click(view.getByText("Delete"));

    await waitFor(() => {
      expect(mockDeleteChat).toHaveBeenCalledWith("thread-1");
      expect(mockRefreshSidebarChats).toHaveBeenCalled();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  test("starts title regen and resolves when the API returns", async () => {
    const view = renderMenu();

    fireEvent.click(view.getByText("Regenerate title (AI)"));

    expect(mockBeginTitleRegen).toHaveBeenCalledWith("thread-1", "Thread One");
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);

    await waitFor(() => {
      expect(mockResolveTitleRegen).toHaveBeenCalledWith("thread-1", "Fresh Title");
    });
    expect(mockFinishTitleRegen).not.toHaveBeenCalled();
  });

  test("blocks regenerate while that thread is already regenerating", () => {
    startTitleRegen("thread-1", "Thread One");
    mockIsTitleRegenerating.mockImplementation((id: string) => id === "thread-1");
    const view = renderMenu();

    const label = view.getByText("Generating title…");
    const button = label.closest("button");
    expect(button?.disabled).toBe(true);
    fireEvent.click(label);
    expect(mockBeginTitleRegen).not.toHaveBeenCalled();
  });
});

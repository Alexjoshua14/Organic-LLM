import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";

import { render } from "../helpers/render";

const mockRouterPush = mock(() => {});
const mockSetChatId = mock(() => {});
const mockRefreshSidebarChats = mock(() => {});
const mockSetOpenMobile = mock(() => {});
const mockUpdateChatTitle = mock(async () => ({ ok: true, error: null }));
const mockUpdateChatPinned = mock(async () => ({ ok: true, error: null }));
const mockDeleteChat = mock(async () => ({ ok: true, error: null }));

let currentPathname = "/";
let currentChatId: string | null = null;
let currentIsMobile = false;

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => currentPathname,
}));

mock.module("@/hooks/use-chat-id", () => ({
  useChatId: () => currentChatId,
}));

mock.module("@/hooks/use-mobile", () => ({
  useIsMobile: () => currentIsMobile,
}));

mock.module("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  },
}));

mock.module("@/data/supabase/chat", () => ({
  updateChatTitle: mockUpdateChatTitle,
  updateChatPinned: mockUpdateChatPinned,
  deleteChat: mockDeleteChat,
}));

mock.module("@/components/third-party/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    className,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    className?: string;
  }) => (
    <button className={className} onClick={() => onSelect?.()}>
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

mock.module("@/components/sidebar/sidebar-chat-title", () => ({
  SidebarChatTitle: ({
    title,
    editing,
    onSave,
  }: {
    title: string;
    editing: boolean;
    onSave: (title: string) => void;
  }) =>
    editing ? (
      <button onClick={() => onSave("Renamed Thread")}>
        Save edited title
      </button>
    ) : (
      <h3>{title}</h3>
    ),
}));

import { SidebarProvider } from "@/components/third-party/ui/sidebar";
import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";
import { SidebarChatList } from "@/components/sidebar/sidebar-chat-list";

const thread = {
  id: "thread-1",
  title: "Thread One",
  pinned: false,
  date: "2026-03-08T01:00:00.000Z",
};

describe("SidebarChatList", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    mock.restore();
  });

  beforeEach(() => {
    mockRouterPush.mockReset();
    mockSetChatId.mockReset();
    mockRefreshSidebarChats.mockReset();
    mockSetOpenMobile.mockReset();
    mockUpdateChatTitle.mockReset();
    mockUpdateChatPinned.mockReset();
    mockDeleteChat.mockReset();

    mockUpdateChatTitle.mockResolvedValue({ ok: true, error: null });
    mockUpdateChatPinned.mockResolvedValue({ ok: true, error: null });
    mockDeleteChat.mockResolvedValue({ ok: true, error: null });

    currentPathname = "/";
    currentChatId = null;
    currentIsMobile = false;
  });

  function renderList() {
    return render(
      <ChatContext.Provider
        value={
          {
            chat: {} as ChatContextValue["chat"],
            clearChat: () => {},
            setChatId: mockSetChatId,
            chatId: "",
            sidebarChats: [thread],
            isSidebarChatsLoading: false,
            sidebarChatsError: null,
            refreshSidebarChats: mockRefreshSidebarChats,
          } as ChatContextValue
        }
      >
        <SidebarProvider>
          <SidebarChatList threads={[thread]} />
        </SidebarProvider>
      </ChatContext.Provider>,
    );
  }

  test("navigates to the selected thread and records the active chat id", async () => {
    const view = renderList();

    fireEvent.click(view.getByLabelText("Open Thread One"));

    expect(mockSetChatId).toHaveBeenCalledWith("thread-1");
    expect(mockRouterPush).toHaveBeenCalledWith("/chat/thread-1");
  });

  test("renames a thread and refreshes the sidebar list", async () => {
    const view = renderList();

    fireEvent.click(view.getByText("Edit title"));
    fireEvent.click(await view.findByText("Save edited title"));

    await waitFor(() => {
      expect(mockUpdateChatTitle).toHaveBeenCalledWith(
        "thread-1",
        "Renamed Thread",
      );
    });
    expect(mockRefreshSidebarChats).toHaveBeenCalled();
  });

  test("toggles pin state and refreshes on success", async () => {
    const view = renderList();

    fireEvent.click(view.getByText("Pin"));

    await waitFor(() => {
      expect(mockUpdateChatPinned).toHaveBeenCalledWith("thread-1", true);
    });
    expect(mockRefreshSidebarChats).toHaveBeenCalled();
  });

  test("ignores the first title click immediately after a mobile long press", async () => {
    currentIsMobile = true;
    const view = renderList();

    const openThreadButton = view.getByLabelText("Open Thread One");

    fireEvent.touchStart(openThreadButton);
    await new Promise((resolve) => setTimeout(resolve, 550));
    fireEvent.click(openThreadButton);

    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.click(openThreadButton);

    expect(mockRouterPush).toHaveBeenCalledWith("/chat/thread-1");
  });
});

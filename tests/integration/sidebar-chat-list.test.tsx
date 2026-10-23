import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import * as framerMotion from "framer-motion";

import { mockModulePreservingReal } from "../helpers/module-mock";
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

/**
 * Only `motion.div` is swapped for a plain element. `motion` is a Proxy, so the rest is
 * forwarded to the real one: a stub that dropped `motion.svg` used to leak into later files
 * and break any component animating an icon.
 */
const restoreFramerMotion = mockModulePreservingReal("framer-motion", framerMotion, (real) => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: new Proxy(real.motion, {
    get: (target, prop) =>
      prop === "div"
        ? (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />
        : Reflect.get(target, prop),
  }),
}));

afterAll(restoreFramerMotion);

mock.module("@/data/supabase/chat", () => ({
  updateChatTitle: mockUpdateChatTitle,
  updateChatPinned: mockUpdateChatPinned,
  deleteChat: mockDeleteChat,
}));

/**
 * Every export is stubbed, deliberately: this mock stays installed for later files, and a
 * partial one left real Radix items rendering inside these plain-`div` roots, which throws
 * "`MenuItem` must be used within `Menu`". Merging the real module back in would reintroduce
 * exactly that mix, so the stub has to cover the whole surface instead.
 */
const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const menuItemStub = ({
  children,
  onSelect,
  onCheckedChange,
  className,
}: {
  children?: ReactNode;
  onSelect?: () => void;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) => (
  <button
    className={className}
    onClick={() => {
      onSelect?.();
      onCheckedChange?.(true);
    }}
  >
    {children}
  </button>
);

mock.module("@/components/third-party/ui/dropdown-menu", () => ({
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuGroup: passthrough,
  DropdownMenuPortal: passthrough,
  DropdownMenuSub: passthrough,
  DropdownMenuSubContent: passthrough,
  DropdownMenuSubTrigger: passthrough,
  DropdownMenuRadioGroup: passthrough,
  DropdownMenuLabel: passthrough,
  DropdownMenuShortcut: passthrough,
  DropdownMenuItem: menuItemStub,
  DropdownMenuCheckboxItem: menuItemStub,
  DropdownMenuRadioItem: menuItemStub,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuPrimitive: {},
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
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });
    fireEvent.click(openThreadButton);

    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.click(openThreadButton);

    expect(mockRouterPush).toHaveBeenCalledWith("/chat/thread-1");
  });

  test("shows each row's experience and signal: status line while working, lit when new", () => {
    const hole = {
      id: "thread-hole",
      title: "Why did Rome fall?",
      pinned: false,
      date: "2026-03-08T02:00:00.000Z",
      feature: "rabbit_hole",
      href: "/rabbitholes?sessionId=abc",
    };
    const signals = new Map([
      [hole.id, { kind: "working" as const, step: "article" as const }],
      [thread.id, { kind: "new" as const }],
    ]);

    const view = render(
      <ChatContext.Provider
        value={
          {
            chat: {} as ChatContextValue["chat"],
            clearChat: () => {},
            setChatId: mockSetChatId,
            chatId: "",
            sidebarChats: [thread, hole],
            isSidebarChatsLoading: false,
            sidebarChatsError: null,
            refreshSidebarChats: mockRefreshSidebarChats,
          } as ChatContextValue
        }
      >
        <SidebarProvider>
          <SidebarChatList signals={signals} threads={[thread, hole]} />
        </SidebarProvider>
      </ChatContext.Provider>,
    );

    const holeRow = view.container.querySelector('[data-sidebar-thread="thread-hole"]');
    const chatRow = view.container.querySelector('[data-sidebar-thread="thread-1"]');

    expect(holeRow?.getAttribute("data-session-signal")).toBe("working");
    expect(holeRow?.querySelector("svg")?.getAttribute("data-experience")).toBe("rabbitHole");
    expect(view.getByText("Writing article")).toBeDefined();
    expect(view.getByText("Rabbit hole, writing article")).toBeDefined();

    expect(chatRow?.getAttribute("data-session-signal")).toBe("new");
    expect(chatRow?.querySelector("svg")?.getAttribute("data-signal")).toBe("new");
    expect(view.getByText("Chat, new activity")).toBeDefined();
  });

  describe("title regeneration", () => {
    const realFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    test("acknowledges at once, shows progress, then settles on success", async () => {
      let respond: (res: Response) => void = () => {};

      globalThis.fetch = mock(
        () => new Promise<Response>((resolve) => (respond = resolve))
      ) as unknown as typeof fetch;

      const view = renderList();
      const row = () => view.container.querySelector('[data-sidebar-thread="thread-1"]');

      fireEvent.click(view.getByText("Regenerate title (AI)"));

      expect(await view.findByText("Generating title")).toBeDefined();
      expect(row()?.getAttribute("data-session-signal")).toBe("working");
      expect(view.getByRole("status").textContent).toContain("Generating a new title");

      await act(async () => {
        respond(new Response(JSON.stringify({ data: "Better Title" }), { status: 200 }));
      });

      await waitFor(() => expect(row()?.getAttribute("data-session-signal")).toBe("idle"));
      expect(view.queryByText("Generating title")).toBeNull();
      expect(view.getByRole("status").textContent).toBe("Title updated: Better Title");
      expect(mockRefreshSidebarChats).toHaveBeenCalled();
    });

    test("says why when generation is refused", async () => {
      globalThis.fetch = mock(
        async () => new Response(JSON.stringify({ error: "Too many" }), { status: 429 })
      ) as unknown as typeof fetch;

      const view = renderList();

      fireEvent.click(view.getByText("Regenerate title (AI)"));

      await waitFor(() =>
        expect(view.getByRole("status").textContent).toBe("Title limit reached — try later")
      );
      // Shown on the row itself, and announced.
      expect(view.getAllByText("Title limit reached — try later").length).toBe(2);
      expect(
        view.container
          .querySelector('[data-sidebar-thread="thread-1"]')
          ?.getAttribute("data-session-signal")
      ).toBe("notice");
      expect(mockRefreshSidebarChats).not.toHaveBeenCalled();
    });
  });

  test("rows without a signal are idle and show no status line", () => {
    const view = renderList();
    const row = view.container.querySelector('[data-sidebar-thread="thread-1"]');

    expect(row?.getAttribute("data-session-signal")).toBe("idle");
    expect(view.queryByText("Responding")).toBeNull();
    expect(view.getByText("Chat")).toBeDefined();
  });
});

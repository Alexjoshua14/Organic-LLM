/** Runs separately so the Clerk loading mocks cannot leak into other tests. */
import { mock } from "bun:test";
import type { ReactNode } from "react";
import { cleanup } from "@testing-library/react";

import { render } from "./render";
import type { ChatContextValue } from "@/lib/context/chat-context";

let clerkLoaded = false;
const passthrough = ({ children }: { children: ReactNode }) => children;

mock.module("@clerk/nextjs", () => ({
  // App Router SignedIn knows the server session before client Clerk finishes loading.
  SignedIn: passthrough,
  SignedOut: () => null,
  ClerkLoading: ({ children }: { children: ReactNode }) => (clerkLoaded ? null : children),
  SignOutButton: () => <button type="button">Sign out</button>,
  SignInButton: passthrough,
  SignUpButton: passthrough,
  useAuth: () => ({ isLoaded: clerkLoaded, userId: "user-sidebar" }),
}));
mock.module("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {} }),
}));
mock.module("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
mock.module("@/hooks/use-chat-id", () => ({ useChatId: () => null }));
mock.module("@/components/sidebar/prototypes-sidebar-content", () => ({
  PrototypesSidebarContent: () => null,
  PrototypesSidebarFallback: () => null,
}));

const { Sidebar } = await import("@/components/sidebar/sidebar");
const { SidebarProvider } = await import("@/components/third-party/ui/sidebar");
const { ChatContext } = await import("@/lib/context/chat-context");
const { FeatureHintRegistryProvider } = await import("@/lib/onboarding/feature-hint-context");

const loadingValue = {
  sidebarChats: [],
  sidebarPinnedChats: [],
  sidebarUnpinnedChats: [],
  isSidebarChatsLoading: true,
  isSidebarChatsLoadingMore: false,
  hasMoreSidebarChats: false,
  loadMoreSidebarChats: () => {},
  setChatId: () => {},
  refreshSidebarChats: () => {},
} satisfies Partial<ChatContextValue>;

function sidebar(value: Partial<ChatContextValue>) {
  return (
    <FeatureHintRegistryProvider>
      <ChatContext.Provider value={value as ChatContextValue}>
        <SidebarProvider>
          <Sidebar />
        </SidebarProvider>
      </ChatContext.Provider>
    </FeatureHintRegistryProvider>
  );
}

const view = render(sidebar(loadingValue));
const rail = view.container.querySelector("[data-sidebar-experience-rail]");
if (!rail) throw new Error("Sidebar navigation is missing");
const search = view.getByPlaceholderText("Search your threads...");

function snapshot() {
  const loaders = view.queryAllByRole("status", { name: "Loading threads" });
  return {
    loaderCount: loaders.length,
    headingCount: view.queryAllByText("All Threads").length,
    belowSearch:
      loaders.length === 1 &&
      Boolean(search.compareDocumentPosition(loaders[0]!) & Node.DOCUMENT_POSITION_FOLLOWING),
    inScroller:
      loaders.length === 1 && loaders[0]!.parentElement?.classList.contains("overflow-y-auto"),
    sameNavigation:
      rail === view.container.querySelector("[data-sidebar-experience-rail]") &&
      search === view.getByPlaceholderText("Search your threads..."),
  };
}

const sessionLoading = snapshot();
clerkLoaded = true;
view.rerender(sidebar(loadingValue));
const threadsLoading = snapshot();
view.rerender(
  sidebar({
    ...loadingValue,
    isSidebarChatsLoading: false,
    sidebarUnpinnedChats: [
      { id: "thread-1", title: "Loaded thread", pinned: false, date: "2026-10-06T00:00:00.000Z" },
    ],
  })
);
const loaded = {
  ...snapshot(),
  hasThread: view.queryByRole("button", { name: "Open Loaded thread" }) !== null,
};

cleanup();
console.log(JSON.stringify({ sessionLoading, threadsLoading, loaded }));

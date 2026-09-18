import type { ReactNode } from "react";

import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";
import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";
import { defaultUserSettings, type UserSettings } from "@/lib/schemas/userSettings";
import { render } from "../helpers/render";

// ---------------------------------------------------------------------------
// Browser globals the shared jsdom install leaves out. Installed for this file only and
// restored afterwards, because Bun runs every test file in one process.
//
// - matchMedia: the composer submits on Enter only for fine pointers.
// - ResizeObserver: CoreInput and the lumen shells observe the prompt shell.
// - DOM constructors (HTMLFormElement, DocumentFragment, …): Radix and Testing Library
//   reference them as bare globals; copied from the jsdom window when Bun lacks them.
// - AbortController / AbortSignal: Framer Motion's hover gesture passes a signal into
//   jsdom's addEventListener, which rejects Bun's native signal.
// ---------------------------------------------------------------------------

type Win = typeof window & Record<string, unknown>;

/** Replaced even when Bun defines them, because jsdom only accepts its own instances. */
const JSDOM_OVERRIDES = ["AbortController", "AbortSignal"];
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();

function setGlobal(target: object, name: string, value: unknown) {
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
}

/** jsdom interface constructors (`HTMLFormElement`, `DocumentFragment`, …) missing from Bun. */
function missingDomConstructors(win: Win): string[] {
  return Object.getOwnPropertyNames(win).filter(
    (name) =>
      /^(HTML|SVG|Document|Text|Comment|Range|Selection|NodeFilter|TreeWalker|Shadow|Custom|DOM)/.test(
        name
      ) &&
      typeof win[name] === "function" &&
      !(name in globalThis)
  );
}

beforeAll(() => {
  registerUserSettingsMock();

  const win = window as Win;
  const copied = [...missingDomConstructors(win), ...JSDOM_OVERRIDES];

  for (const name of [...copied, "matchMedia", "ResizeObserver"]) {
    savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  savedGlobals.set("window.matchMedia", Object.getOwnPropertyDescriptor(win, "matchMedia"));
  for (const name of copied) setGlobal(globalThis, name, win[name]);

  const matchMedia = (query: string) => ({
    matches: query.includes("any-pointer: fine") || query.includes("any-hover: hover"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });

  setGlobal(win, "matchMedia", matchMedia);
  setGlobal(globalThis, "matchMedia", matchMedia);
  setGlobal(
    globalThis,
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterAll(() => {
  const win = window as Win;

  for (const [key, descriptor] of savedGlobals) {
    const [target, name] = key.startsWith("window.")
      ? [win, key.slice("window.".length)]
      : [globalThis, key];

    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete (target as Record<string, unknown>)[name];
  }
});

// ---------------------------------------------------------------------------
// Module mocks. `search` is what `useSearchParams` reports; `router.replace` writes it back
// so a test can `rerender` after the lab changes the URL.
// ---------------------------------------------------------------------------

let search = "";
const mockReplace = mock((href: string) => {
  search = href.split("?")[1] ?? "";
});

mock.module("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mock(() => {}) }),
  usePathname: () => "/sandbox/prototypes/core-input",
  useSearchParams: () => new URLSearchParams(search),
}));

mock.module("next/link", () => ({
  default: ({ children, href, ...props }: { children?: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const USER_SETTINGS_STORAGE_KEY = "organic-llm-user-settings";

function readSettings(): UserSettings {
  const stored = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);

  if (!stored) return defaultUserSettings();

  try {
    return { ...defaultUserSettings(), ...JSON.parse(stored) };
  } catch {
    return defaultUserSettings();
  }
}

/**
 * Other integration files register partial `@/lib/user-settings` mocks without `setSettings`,
 * and Bun module mocks are process-wide. CoreInput and the lab both import `setSettings`, so
 * register a complete localStorage-backed mock and re-register it before this file's tests.
 */
function registerUserSettingsMock() {
  mock.module("@/lib/user-settings", () => ({
    USER_SETTINGS_STORAGE_KEY,
    getSettings: readSettings,
    getFontId: () => readSettings().fontId,
    setSettings: (partial: Partial<UserSettings>) => {
      const next = { ...readSettings(), ...partial };

      localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new window.Event("organic-llm-settings"));

      return next;
    },
  }));
}

registerUserSettingsMock();

mock.module("@clerk/nextjs", () => ({
  useAuth: () => ({ userId: "user_lab_test", isSignedIn: true, isLoaded: true }),
  useUser: () => ({ user: { id: "user_lab_test" }, isSignedIn: true, isLoaded: true }),
  ClerkProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  UserButton: () => null,
}));

// "use server" module behind useIsAdmin; Bun cannot load it in tests.
mock.module("@/data/supabase/profiles", () => ({
  getShowSandboxGatewayForCurrentUser: async () => true,
}));

// `Page` needs the sidebar provider; the lab only needs a container here.
mock.module("@/components/layout/page", () => ({
  default: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

// WebGL shader; never rendered on the default backdrop but imported at module level.
mock.module("@/components/background/AdaptiveLiquidChrome", () => ({
  default: () => null,
}));

const chatContextValue = {
  chat: {} as never,
  clearChat: () => {},
  setChatId: () => {},
  chatId: "",
  sidebarChats: [],
  isSidebarChatsLoading: false,
  sidebarChatsError: null,
  refreshSidebarChats: () => {},
} satisfies ChatContextValue;

function Providers({ children }: { children: ReactNode }) {
  return (
    <ChatContext.Provider value={chatContextValue}>
      <FeatureHintRegistryProvider>{children}</FeatureHintRegistryProvider>
    </ChatContext.Provider>
  );
}

async function renderLab() {
  const { CoreInputLab } = await import(
    "@/app/sandbox/prototypes/core-input/_components/core-input-lab"
  );
  // A fresh element per call: re-rendering the identical element lets React bail out,
  // so the lab would never re-read the mocked search params.
  const makeUi = () => (
    <Providers>
      <CoreInputLab />
    </Providers>
  );
  const result = render(makeUi());

  return { ...result, rerenderLab: () => result.rerender(makeUi()) };
}

describe("CoreInput lab", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
    search = "";
    mockReplace.mockClear();
  });

  test("product view mounts the shipped composer on lab-only pref keys", async () => {
    const { container, getByRole, getByText } = await renderLab();

    expect(getByRole("heading", { name: "CoreInput lab" })).toBeTruthy();
    expect(container.querySelector("textarea[name='message']")).toBeTruthy();
    expect(container.querySelector("[aria-label='Model']")).toBeTruthy();
    expect(getByRole("button", { name: /^web search (on|off)$/i })).toBeTruthy();
    expect(getByRole("button", { name: /^memory (on|off)$/i })).toBeTruthy();
    expect(getByRole("button", { name: "Submit" })).toBeTruthy();
    expect(getByText("Shell")).toBeTruthy();

    // CoreInput persists model/effort/memory once prefs load — under the lab's keys only.
    await waitFor(() =>
      expect(localStorage.getItem("organic-llm-lab-core-input-model")).toBeTruthy()
    );
    expect(localStorage.getItem("organic-llm-selected-model")).toBeNull();
  });

  test("a send runs the simulated submitted → streaming timeline", async () => {
    const user = userEvent.setup();
    const { container, getByRole, findByRole, getByText } = await renderLab();
    const textarea = container.querySelector("textarea[name='message']") as HTMLTextAreaElement;

    await user.type(textarea, "hello lab");
    await user.click(getByRole("button", { name: "Submit" }));

    // Stop button appears while the simulated request is in flight.
    expect(await findByRole("button", { name: "Abort" })).toBeTruthy();
    expect(getByText("“hello lab”")).toBeTruthy();

    await waitFor(() => expect(getByText("streaming")).toBeTruthy(), { timeout: 3_000 });
  });

  test("focus view lists every control and honours ?control", async () => {
    search = "view=focus";
    const { getByRole, queryByRole, rerenderLab } = await renderLab();
    const { FOCUS_CONTROLS } = await import(
      "@/app/sandbox/prototypes/core-input/_components/focus-stage"
    );

    for (const control of FOCUS_CONTROLS) {
      expect(getByRole("heading", { name: control.title })).toBeTruthy();
    }

    // Focusing a card rewrites the URL; re-render to pick the new params up.
    await userEvent.setup().click(
      within(getByRole("heading", { name: "Send button" }).closest("section")!).getByRole(
        "button",
        { name: "Focus" }
      )
    );
    expect(search).toBe("view=focus&control=submit");
    rerenderLab();

    expect(getByRole("heading", { name: "Send button" })).toBeTruthy();
    expect(queryByRole("heading", { name: "Tool toggles" })).toBeNull();
    expect(getByRole("button", { name: "Show all" })).toBeTruthy();
  });

  test("interactive chips drive lab state while pinned cells hold theirs", async () => {
    search = "view=focus&control=tool-toggles";
    const user = userEvent.setup();
    const { getAllByRole, getByRole } = await renderLab();

    // Interactive (on by default) + two pinned-on cells; two pinned-off cells.
    expect(getAllByRole("button", { name: "Web search on" })).toHaveLength(3);
    expect(getAllByRole("button", { name: "Web search off" })).toHaveLength(2);

    await user.click(getAllByRole("button", { name: "Web search on" })[0]!);

    expect(getAllByRole("button", { name: "Web search on" })).toHaveLength(2);
    expect(getAllByRole("button", { name: "Web search off" })).toHaveLength(3);
    expect(getByRole("switch", { name: "Web search" }).getAttribute("aria-checked")).toBe("false");

    // Pinned cells ignore clicks.
    await user.click(getAllByRole("button", { name: "Web search off" })[1]!);
    expect(getAllByRole("button", { name: "Web search off" })).toHaveLength(3);
  });
});

import type { CoreInputInitialSettings } from "@/lib/core-input/settings-cookie";
import type { ReactNode } from "react";

import { afterAll, afterEach, beforeAll, describe, expect, mock, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { render } from "../helpers/render";

import { CoreInput } from "@/components/chat/core-input";
import { ChatModels } from "@/lib/schemas/chat";
import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { coreInputSnapshots } from "@/lib/core-input/snapshot-store";
import { coreInputScopes, type CoreInputScope } from "@/lib/core-input/scopes";
import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";
import { ChatContext, type ChatContextValue } from "@/lib/context/chat-context";
import { defaultUserSettings, type UserSettings } from "@/lib/schemas/userSettings";

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
  useAuth: () => ({
    userId: "user_lab_test",
    sessionId: "session_lab_test",
    isSignedIn: true,
    isLoaded: true,
  }),
  useUser: () => ({ user: { id: "user_lab_test" }, isSignedIn: true, isLoaded: true }),
  ClerkProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  UserButton: () => null,
}));

// The shared visibility query stays local to this test.
mock.module("@/data/supabase/gateway-visibility", () => ({
  getGatewayVisibilityForCurrentUser: async () => true,
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
  titleRegenThreadIds: new Set<string>(),
  isTitleRegenerating: () => false,
  getTitleRegenBurnText: (_threadId: string, fallbackTitle: string) => fallbackTitle,
  beginTitleRegen: () => {},
  resolveTitleRegen: () => {},
  isTitleRegenReadyToCommit: () => false,
  finishTitleRegen: () => {},
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
    await userEvent
      .setup()
      .click(
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

  test("the live voice bar toggle renders the real bar in the composer's drawer slot", async () => {
    const user = userEvent.setup();
    const { findByRole, findByText, queryByRole, getByRole } = await renderLab();
    const voiceBar = within(getByRole("radiogroup", { name: "Live voice bar" }));

    expect(queryByRole("button", { name: "End voice session" })).toBeNull();

    await user.click(voiceBar.getByRole("radio", { name: "Live" }));
    expect(await findByRole("button", { name: "End voice session" })).toBeTruthy();

    await user.click(voiceBar.getByRole("radio", { name: "Connecting" }));
    expect(await findByText("Connecting voice session")).toBeTruthy();

    // Paused shows the real Resume button, and pressing it goes live, as the real bar would.
    // The drawer slot is aria-hidden unless connected (or Stage), so query hidden elements.
    await user.click(voiceBar.getByRole("radio", { name: "Paused" }));
    await user.click(await findByRole("button", { name: "Resume voice session", hidden: true }));
    expect(await findByRole("button", { name: "End voice session" })).toBeTruthy();

    // The bar's own End button turns the toggle back off.
    await user.click(await findByRole("button", { name: "End voice session" }));
    await waitFor(() =>
      expect(voiceBar.getByRole("radio", { name: "Off" }).getAttribute("aria-checked")).toBe("true")
    );
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

  test.each(["submitted", "streaming"] as const)(
    "the shipped composer blocks Enter and direct form submission while %s without losing the draft",
    async (status) => {
      const sendMessage = mock(async () => {});
      const stop = mock(async () => {});
      const makeUi = (nextStatus: typeof status | "ready") => (
        <Providers>
          <CoreInput
            modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
            useWebSearchRef={{ current: false }}
            useMemoriesRef={{ current: false }}
            sendMessage={sendMessage}
            stop={stop}
            status={nextStatus}
            featureHints={false}
            showContextBudget={false}
          />
        </Providers>
      );
      const view = render(makeUi(status));
      const textarea = view.container.querySelector("textarea")!;
      const user = userEvent.setup();

      await user.type(textarea, "Keep this next draft");
      await user.keyboard("{Enter}");
      await act(async () => fireEvent.submit(textarea.form!));
      expect(sendMessage).not.toHaveBeenCalled();
      expect(textarea.value).toBe("Keep this next draft");
      await user.click(view.getByRole("button", { name: "Abort" }));
      expect(stop).toHaveBeenCalledTimes(1);
      expect(sendMessage).not.toHaveBeenCalled();

      view.rerender(makeUi("ready"));
      await user.click(view.getByRole("button", { name: "Submit" }));
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Keep this next draft" })
      );
    }
  );

  test("the shipped composer blocks repeated submissions before the parent publishes a busy status", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const sendMessage = mock(() => pending);
    const view = render(
      <Providers>
        <CoreInput
          modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
          useWebSearchRef={{ current: false }}
          useMemoriesRef={{ current: false }}
          sendMessage={sendMessage}
          stop={async () => {}}
          status="ready"
          featureHints={false}
          showContextBudget={false}
        />
      </Providers>
    );
    const textarea = view.container.querySelector("textarea")!;

    await userEvent.setup().type(textarea, "One turn");
    await act(async () => {
      fireEvent.submit(textarea.form!);
      fireEvent.submit(textarea.form!);
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    await userEvent.setup().type(textarea, "Next draft");
    await act(async () => fireEvent.submit(textarea.form!));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(textarea.value).toBe("Next draft");
    await act(async () => finish());
    await userEvent.setup().click(view.getByRole("button", { name: "Submit" }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  test("a disabled composer rejects direct form submission and retains its draft", async () => {
    const sendMessage = mock(async () => {});
    const view = render(
      <Providers>
        <CoreInput
          modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
          useWebSearchRef={{ current: false }}
          useMemoriesRef={{ current: false }}
          sendMessage={sendMessage}
          stop={async () => {}}
          status="ready"
          disabled
          featureHints={false}
          showContextBudget={false}
        />
      </Providers>
    );
    const textarea = view.container.querySelector("textarea")!;

    await userEvent.setup().type(textarea, "Waiting for reconnection");
    await act(async () => fireEvent.submit(textarea.form!));
    expect(sendMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe("Waiting for reconnection");
  });

  test("explicit queue mode can enqueue during streaming without invoking the live send handler", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ items: [], openQueue: [] })
    );
    const sendMessage = mock(async () => {});

    try {
      const view = render(
        <Providers>
          <CoreInput
            modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
            useWebSearchRef={{ current: false }}
            useMemoriesRef={{ current: false }}
            sendMessage={sendMessage}
            stop={async () => {}}
            status="streaming"
            chatId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            queueSendMode
            featureHints={false}
            showContextBudget={false}
          />
        </Providers>
      );

      await userEvent.setup().type(view.container.querySelector("textarea")!, "Queue this turn");
      await userEvent.setup().click(view.getByRole("button", { name: "Submit" }));
      expect(sendMessage).not.toHaveBeenCalled();
      expect(fetchSpy.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(
        1
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("CoreInput snapshot scopes", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  const webSearchChip = (view: ReturnType<typeof render>) =>
    view.getByRole("button", { name: /^web search (on|off)$/i });
  /**
   * Scope changes morph over ~400ms of real time; wait for the composer to settle. The /btw test
   * waits three times and took 5.5s on the Linux runner against Bun's 5s default, so these tests
   * carry an explicit limit, and a timed-out test no longer leaves work running into later files.
   */
  const SLOW_UI_TEST_MS = 30_000;
  const settled = (view: ReturnType<typeof render>) =>
    waitFor(() => expect(view.container.querySelector("[data-core-input-morph]")).toBeNull(), {
      timeout: 8_000,
    });

  test(
    "a /btw scope keeps its own settings and the thread's snap back on close",
    async () => {
      // Sync is best-effort; a missing table keeps the composer local-only.
      const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
        async () => new Response("{}", { status: 503 })
      );
      const threadId = crypto.randomUUID();
      const thread = coreInputScopes.thread("arcadia", threadId);
      const btw = coreInputScopes.btw("arcadia", threadId);
      const webSearchRef = { current: true };
      const makeUi = (scope: CoreInputScope) => (
        <Providers>
          <CoreInput
            modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
            useWebSearchRef={webSearchRef}
            useMemoriesRef={{ current: false }}
            sendMessage={mock(async () => {})}
            stop={async () => {}}
            status="ready"
            featureHints={false}
            showContextBudget={false}
            snapshotScope={scope}
          />
        </Providers>
      );

      try {
        const user = userEvent.setup();
        const view = render(makeUi(thread));

        await settled(view);
        if (webSearchChip(view).getAttribute("aria-label") === "Web search on") {
          await user.click(webSearchChip(view));
        }
        expect(webSearchChip(view).getAttribute("aria-label")).toBe("Web search off");

        // Opening /btw starts from the thread's settings; changing them stays in the side thread.
        view.rerender(makeUi(btw));
        await settled(view);
        expect(webSearchChip(view).getAttribute("aria-label")).toBe("Web search off");
        await user.click(webSearchChip(view));
        expect(webSearchChip(view).getAttribute("aria-label")).toBe("Web search on");
        expect(webSearchRef.current).toBe(true);

        // Closing /btw morphs back to the thread, and the refs a send reads follow it.
        view.rerender(makeUi(thread));
        await settled(view);
        expect(webSearchChip(view).getAttribute("aria-label")).toBe("Web search off");
        expect(webSearchRef.current).toBe(false);
      } finally {
        fetchSpy.mockRestore();
      }
    },
    SLOW_UI_TEST_MS
  );

  test("a slash command runs while the thread streams and is never sent to it", async () => {
    const sendMessage = mock(async () => {});
    const btw = mock((_question: string) => {});
    const view = render(
      <Providers>
        <CoreInput
          modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
          useWebSearchRef={{ current: false }}
          useMemoriesRef={{ current: false }}
          sendMessage={sendMessage}
          stop={async () => {}}
          status="streaming"
          featureHints={false}
          showContextBudget={false}
          slashCommands={{ btw }}
        />
      </Providers>
    );
    const textarea = view.container.querySelector("textarea")!;

    await userEvent.setup().type(textarea, "/btw what does idempotent mean?");
    await act(async () => fireEvent.submit(textarea.form!));

    expect(btw).toHaveBeenCalledWith("what does idempotent mean?");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe("");

    // Unregistered commands are ordinary text and stay blocked while streaming.
    await userEvent.setup().type(textarea, "/unknown thing");
    await act(async () => fireEvent.submit(textarea.form!));
    expect(sendMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe("/unknown thing");
  });
});

describe("CoreInput first paint", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  const makeUi = (initialSettings?: CoreInputInitialSettings) => (
    <Providers>
      <CoreInput
        initialSettings={initialSettings}
        snapshotScope={
          initialSettings
            ? coreInputScopes.thread("arcadia", initialSettings.scopeKey.split(":thread:")[1]!)
            : undefined
        }
        experience="arcadia"
        enableMarkdownInputPreview={initialSettings?.experimentalArcadiaMarkdownPreview}
        modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
        useWebSearchRef={{ current: true }}
        useMemoriesRef={{ current: false }}
        sendMessage={mock(async () => {})}
        stop={async () => {}}
        status="ready"
        featureHints={false}
        showContextBudget={false}
      />
    </Providers>
  );
  /** The leading settings cluster: the element that wraps the model picker. */
  const settingsCluster = (root: ParentNode) =>
    root.querySelector('[data-core-input-field="model"]')?.parentElement ?? null;

  test("the server render hides the settings controls, holding their space", async () => {
    const { renderToString } = await import("react-dom/server");
    const host = document.createElement("div");

    host.innerHTML = renderToString(makeUi());
    const cluster = settingsCluster(host);

    expect(cluster?.classList.contains("invisible")).toBe(true);
    expect(cluster?.getAttribute("aria-hidden")).toBe("true");
    // Trailing controls don't depend on saved settings and paint immediately.
    const addFiles = host.querySelector('[aria-label="Add files"]');

    expect(addFiles).toBeTruthy();
    expect(addFiles?.closest(".invisible")).toBeNull();
  });

  test("the client reveals them once saved settings are applied", async () => {
    const view = render(makeUi());

    await waitFor(() =>
      expect(settingsCluster(view.container)?.classList.contains("visible")).toBe(true)
    );
    const cluster = settingsCluster(view.container);

    expect(cluster?.classList.contains("invisible")).toBe(false);
    expect(cluster?.hasAttribute("aria-hidden")).toBe(false);
  });

  test("a cookie seed paints the real settings and hydrates without a mismatch", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const scope = coreInputScopes.thread("arcadia", crypto.randomUUID());
    const initial: CoreInputInitialSettings = {
      scopeKey: scope.key,
      experimentalContextEffort: true,
      experimentalArcadiaMarkdownPreview: true,
      settings: {
        modelId: ChatModels.find(
          (model) => !model.adminOnly && model.id !== DEFAULT_COMPOSER_MODEL.id
        )!.id,
        effort: "auto",
        contextEffort: "quick",
        webSearch: false,
        memories: true,
        speechFriendly: false,
      },
    };
    coreInputSnapshots.commit(scope, initial.settings);
    localStorage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...defaultUserSettings(),
        experimentalContextEffort: true,
        experimentalArcadiaMarkdownPreview: true,
      })
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(makeUi(initial));
    document.body.appendChild(host);
    expect(settingsCluster(host)?.classList.contains("visible")).toBe(true);
    expect(host.querySelector('[aria-label="Web search off"]')).toBeTruthy();
    expect(host.querySelector('[data-core-input-field="context-effort"]')).toBeTruthy();
    expect(host.querySelector('[aria-label="Model"]')?.getAttribute("data-model-id")).toBe(
      initial.settings.modelId
    );
    const recoveries: unknown[] = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("{}", { status: 503 })
    );
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, makeUi(initial), {
          onRecoverableError: (error) => recoveries.push(error),
        });
      });
      expect(recoveries).toEqual([]);
      expect(settingsCluster(host)?.classList.contains("visible")).toBe(true);
      expect(host.querySelector("[data-core-input-morph]")).toBeNull();
      expect(host.querySelector('[aria-label="Web search off"]')).toBeTruthy();
    } finally {
      await act(async () => root?.unmount());
      fetchSpy.mockRestore();
      host.remove();
    }
  });

  test("client-only remounts have visible controls before passive preference effects", () => {
    const observed: boolean[] = [];
    const mount = () =>
      render(
        <div
          ref={(node) => {
            if (node) observed.push(settingsCluster(node)?.classList.contains("visible") ?? false);
          }}
        >
          {makeUi()}
        </div>
      );
    const first = mount();
    first.unmount();
    mount();
    expect(observed).toEqual([true, true]);
  });
});

describe("CoreInput shared compact layout", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  test.each(["default", "compact", "stage-beta"] as const)(
    "%s uses the same compact controls, glass, and settings without losing its draft",
    async (variant) => {
      const rect = spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
        width: 375,
        height: 60,
        top: 0,
        left: 0,
        right: 375,
        bottom: 60,
        x: 0,
        y: 0,
        toJSON() {},
      }));
      try {
        const app = render(
          <Providers>
            <CoreInput
              variant={variant}
              modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
              useWebSearchRef={{ current: false }}
              useMemoriesRef={{ current: false }}
              useSpeechFriendlyRef={{ current: false }}
              defaultWebSearch={false}
              defaultMemories={false}
              sendMessage={async () => {}}
              stop={async () => {}}
              status="ready"
              featureHints={false}
              showContextBudget={false}
            />
          </Providers>
        );
        const input = app.getByRole("textbox") as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: "Keep this draft" } });
        expect(app.container.querySelector(".core-input-compact-row")).toBeTruthy();
        expect(
          app.container
            .querySelector("[data-prompt-input-shell]")
            ?.classList.contains("organic-glass-smoke")
        ).toBe(true);
        expect(app.queryByRole("combobox", { name: "Model" })).toBeNull();
        const options = app.getByRole("button", { name: "Composer options" });
        await waitFor(() => expect(options.hasAttribute("disabled")).toBe(false));
        fireEvent.click(options);
        const panel = await app.findByRole("dialog", { name: "Composer settings" });
        expect(panel.classList.contains("organic-glass-smoke")).toBe(true);
        expect(within(panel).getByRole("combobox", { name: "Model" })).toBeTruthy();
        // Photos & files live in the compact row beside the mic and send, not in the panel.
        expect(within(panel).queryByRole("button", { name: "Add files" })).toBeNull();
        expect(
          Boolean(app.container.querySelector('.core-input-compact-row [aria-label="Add files"]'))
        ).toBe(variant !== "stage-beta");
        // Thread references share the `+` button; Stage has no files, so it is the thread entry.
        expect(within(panel).queryByRole("button", { name: "Reference a thread" })).toBeNull();
        expect(
          Boolean(
            app.container.querySelector('.core-input-compact-row [aria-label="Reference a thread"]')
          )
        ).toBe(variant === "stage-beta");
        fireEvent.click(within(panel).getByRole("button", { name: "Web search off" }));
        expect(within(panel).getByRole("button", { name: "Web search on" })).toBeTruthy();
        fireEvent.click(within(panel).getByRole("button", { name: "Memory off" }));
        expect(within(panel).getByRole("button", { name: "Memory on" })).toBeTruthy();
        expect(app.getByRole("textbox") === input).toBe(true);
        expect(input.value).toBe("Keep this draft");
        // No heading or close button: Escape dismisses the panel and returns focus to the trigger.
        expect(within(panel).queryByRole("button", { name: "Close composer settings" })).toBeNull();
        fireEvent.keyDown(panel, { key: "Escape" });
        await waitFor(() =>
          expect(app.queryByRole("dialog", { name: "Composer settings" })).toBeNull()
        );
        expect(document.activeElement).toBe(options);
      } finally {
        rect.mockRestore();
      }
    }
  );
});

describe("CoreInput steer tab", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  /** Pins the measured shell width: narrow is the compact layout, wide is the desktop footer. */
  function withShellWidth(width: number) {
    return spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      width,
      height: 60,
      top: 0,
      left: 0,
      right: width,
      bottom: 60,
      x: 0,
      y: 0,
      toJSON() {},
    }));
  }

  function renderComposer(
    variant: "default" | "compact" | "stage-beta",
    onSecondarySubmit?: (text: string) => void
  ) {
    return render(
      <Providers>
        <CoreInput
          variant={variant}
          modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
          useWebSearchRef={{ current: false }}
          useMemoriesRef={{ current: false }}
          useSpeechFriendlyRef={{ current: false }}
          defaultWebSearch={false}
          defaultMemories={false}
          sendMessage={async () => {}}
          stop={async () => {}}
          status="ready"
          featureHints={false}
          showContextBudget={false}
          onSecondarySubmit={onSecondarySubmit}
        />
      </Providers>
    );
  }

  test("the live voice bar and the steer tab share one strip above the composer", async () => {
    const { LabVoiceBar } = await import(
      "@/app/sandbox/prototypes/core-input/_components/lab-voice-bar"
    );
    const rect = withShellWidth(375);

    try {
      const app = render(
        <LabVoiceBar mode="live" onModeChange={() => {}}>
          <Providers>
            <CoreInput
              modelRef={{ current: DEFAULT_COMPOSER_MODEL }}
              useWebSearchRef={{ current: false }}
              useMemoriesRef={{ current: false }}
              useSpeechFriendlyRef={{ current: false }}
              defaultWebSearch={false}
              defaultMemories={false}
              sendMessage={async () => {}}
              stop={async () => {}}
              status="ready"
              featureHints={false}
              showContextBudget={false}
              onSecondarySubmit={() => {}}
            />
          </Providers>
        </LabVoiceBar>
      );
      const strip = app.container.querySelector(".core-input-strip")!;
      const shell = app.container.querySelector("[data-prompt-input-shell]")!;

      // One row holds the real bar (in the drawer slot) and the tab, both before the composer.
      expect(strip).toBeTruthy();
      await waitFor(() => expect(strip.querySelector("[data-voice-live-bar]")).toBeTruthy());
      expect(
        within(strip as HTMLElement).getByRole("group", { name: "Draft actions" })
      ).toBeTruthy();
      expect(strip.compareDocumentPosition(shell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(strip.contains(shell)).toBe(false);
    } finally {
      rect.mockRestore();
    }
  });

  test.each(["default", "compact", "stage-beta"] as const)(
    "%s puts steer in a tab above the composer, not in the settings panel",
    async (variant) => {
      const rect = withShellWidth(375);

      try {
        const onSecondarySubmit = mock((_text: string) => {});
        const app = renderComposer(variant, onSecondarySubmit);
        const tab = app.getByRole("group", { name: "Draft actions" });
        const shell = app.container.querySelector("[data-prompt-input-shell]")!;
        const steer = within(tab).getByRole("button", { name: "Tune" });

        // The tab comes directly before the shell in document order and is outside the form.
        expect(tab.compareDocumentPosition(shell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(shell.contains(tab)).toBe(false);
        // Empty draft: present but disabled, so the tab never shifts the layout.
        expect(steer.hasAttribute("disabled")).toBe(true);

        const input = app.getByRole("textbox") as HTMLTextAreaElement;

        fireEvent.change(input, { target: { value: "Keep it brief" } });
        await waitFor(() => expect(steer.hasAttribute("disabled")).toBe(false));
        fireEvent.click(steer);
        expect(onSecondarySubmit).toHaveBeenCalledWith("Keep it brief");

        fireEvent.change(input, { target: { value: "   " } });
        await waitFor(() => expect(steer.hasAttribute("disabled")).toBe(true));

        const options = app.getByRole("button", { name: "Composer options" });

        await waitFor(() => expect(options.hasAttribute("disabled")).toBe(false));
        fireEvent.click(options);
        const panel = await app.findByRole("dialog", { name: "Composer settings" });

        expect(within(panel).queryByRole("button", { name: "Tune" })).toBeNull();
        // Nothing in the compact row carries steer either.
        expect(
          app.container.querySelector(".core-input-compact-row [aria-label='Tune']")
        ).toBeNull();
      } finally {
        rect.mockRestore();
      }
    }
  );

  test("a compact composer without a steer action renders no tab", () => {
    const rect = withShellWidth(375);

    try {
      const app = renderComposer("default");

      expect(app.queryByRole("group", { name: "Draft actions" })).toBeNull();
      expect(app.queryByRole("button", { name: "Tune" })).toBeNull();
    } finally {
      rect.mockRestore();
    }
  });

  test("the desktop footer keeps steer inline beside send, with no tab", async () => {
    const rect = withShellWidth(900);

    try {
      const app = renderComposer("default", () => {});

      expect(app.container.querySelector(".core-input-compact-row")).toBeNull();
      expect(app.queryByRole("group", { name: "Draft actions" })).toBeNull();
      const steer = app.getByRole("button", { name: "Tune" });

      expect(steer.closest("[data-core-input-tab]")).toBeNull();
      expect(steer.hasAttribute("disabled")).toBe(true);
      fireEvent.change(app.getByRole("textbox"), { target: { value: "Hello" } });
      await waitFor(() => expect(steer.hasAttribute("disabled")).toBe(false));
    } finally {
      rect.mockRestore();
    }
  });
});

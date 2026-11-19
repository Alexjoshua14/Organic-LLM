import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { ReactNode } from "react";

import { FeatureTip } from "@/components/onboarding/feature-tip";
import { FeatureTipLayer } from "@/components/onboarding/feature-tip-layer";
import {
  OnboardingContext,
  type OnboardingContextValue,
} from "@/components/onboarding/onboarding-context";
import { resetFeatureTipRegistryForTests } from "@/lib/onboarding/feature-tip-registry";
import { onboardingActions } from "@/lib/onboarding/onboarding-actions";
import {
  connectOnboardingStore,
  getOnboardingSnapshot,
  resetOnboardingStoreForTests,
} from "@/lib/onboarding/onboarding-store";
import { TIP_TIMING, type TipTiming } from "@/lib/onboarding/tip-timing";

import { render } from "../helpers/render";

/** Production rules with the clocks shortened so tests do not sleep for seconds. */
const FAST: TipTiming = {
  ...TIP_TIMING,
  settleMs: 0,
  idleMs: 0,
  cooldownMs: 0,
  pollMs: 5,
  recheckMs: 20,
  enterMs: 0,
  exitMs: 0,
};

const context: OnboardingContextValue = {
  autoEligible: true,
  signedIn: true,
  guideOpen: false,
  guideTab: "start",
  openGuide: () => {},
  setGuideOpen: () => {},
  setGuideTab: () => {},
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

type Options = {
  pathname?: string;
  overlayOpen?: () => boolean;
  value?: Partial<OnboardingContextValue>;
  children?: ReactNode;
};

function renderLayer({
  pathname = "/chat/abc",
  overlayOpen = () => false,
  value,
  children,
}: Options = {}) {
  return render(
    <PathnameContext.Provider value={pathname}>
      <OnboardingContext.Provider value={{ ...context, ...value }}>
        <button type="button">Elsewhere</button>
        {children ?? (
          <FeatureTip id="composer-search-memory">
            <div>
              <button type="button">Search</button>
              <button type="button">Memory</button>
            </div>
          </FeatureTip>
        )}
        <FeatureTipLayer anchorProbe={() => true} overlayProbe={overlayOpen} timing={FAST} />
      </OnboardingContext.Provider>
    </PathnameContext.Provider>
  );
}

const tipRecord = (id: string) => getOnboardingSnapshot().state.tips[id];

// Radix may keep the closed dialog mounted for its exit animation.
const isTipOpen = () => document.querySelector('[data-feature-tip][data-state="open"]') !== null;

beforeEach(() => {
  // Radix measures the popover arrow with browser animation-frame APIs.
  window.requestAnimationFrame ??= globalThis.requestAnimationFrame;
  window.cancelAnimationFrame ??= globalThis.cancelAnimationFrame;
  // JSDOM reports a hidden document unless told it is visual; tips never show in background tabs.
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  connectOnboardingStore("user_layer", {
    local: memoryStorage(),
    session: memoryStorage(),
    target: null,
  });
});

afterEach(() => {
  cleanup();
  resetFeatureTipRegistryForTests();
  resetOnboardingStoreForTests();
});

describe("FeatureTipLayer", () => {
  test("shows the tip next to its anchor, announces it and never takes focus", async () => {
    const app = renderLayer();

    const dialog = await app.findByRole("dialog", { name: /what informs each reply/i });

    expect(dialog.getAttribute("data-feature-tip")).toBe("composer-search-memory");
    expect(app.getByRole("status").textContent).toContain("Tip: What informs each reply");
    expect(dialog.contains(document.activeElement)).toBe(false);
    // The anchor's first control is described by the tip while it is open.
    expect(
      app.getByRole("button", { name: "Search" }).getAttribute("aria-describedby")
    ).toBeTruthy();
    // Exactly one dismiss control: no close icon.
    expect(app.queryByRole("button", { name: /dismiss|close/i })).toBeNull();
  });

  test("Got it dismisses for good", async () => {
    const app = renderLayer();

    fireEvent.click(await app.findByRole("button", { name: "Got it" }));

    await waitFor(() => expect(isTipOpen()).toBe(false));
    expect(tipRecord("composer-search-memory")?.outcome).toBe("dismissed");
    expect(app.getByRole("button", { name: "Search" }).hasAttribute("aria-describedby")).toBe(
      false
    );
  });

  test("Escape dismisses for good", async () => {
    const app = renderLayer();

    await app.findByRole("dialog");
    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() => expect(isTipOpen()).toBe(false));
    expect(tipRecord("composer-search-memory")?.outcome).toBe("dismissed");
  });

  test("a click elsewhere reaches its target and only hides the tip for this session", async () => {
    let clicked = 0;
    const app = renderLayer({
      children: (
        <>
          <button type="button" onClick={() => (clicked += 1)}>
            Other control
          </button>
          <FeatureTip id="composer-search-memory">
            <div>
              <button type="button">Search</button>
            </div>
          </FeatureTip>
        </>
      ),
    });

    await app.findByRole("dialog");
    // Radix registers the outside pointer listener on the next task after the layer mounts.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    const other = app.getByRole("button", { name: "Other control" });

    fireEvent.pointerDown(other);
    fireEvent.click(other);

    await waitFor(() =>
      expect(getOnboardingSnapshot().sessionHiddenTips.has("composer-search-memory")).toBe(true)
    );
    expect(isTipOpen()).toBe(false);
    expect(clicked).toBe(1);
    expect(tipRecord("composer-search-memory")).toBeUndefined();
    expect(getOnboardingSnapshot().state.implicitCloses["composer-search-memory"]).toBe(1);
  });

  test("using the anchored control counts as acted", async () => {
    const app = renderLayer();

    await app.findByRole("dialog");

    const search = app.getByRole("button", { name: "Search" });

    fireEvent.pointerDown(search);
    fireEvent.click(search);

    await waitFor(() => expect(isTipOpen()).toBe(false));
    expect(tipRecord("composer-search-memory")?.outcome).toBe("acted");
  });

  test("Turn off tips switches every tip off", async () => {
    const app = renderLayer();

    fireEvent.click(await app.findByRole("button", { name: "Turn off tips" }));

    await waitFor(() => expect(isTipOpen()).toBe(false));
    expect(getOnboardingSnapshot().state.tipsEnabled).toBe(false);
    expect(tipRecord("composer-search-memory")?.outcome).toBe("off");
  });

  test("waits while another layer is open, then closes if one opens", async () => {
    let overlay = true;
    const app = renderLayer({ overlayOpen: () => overlay });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(isTipOpen()).toBe(false);

    overlay = false;
    await app.findByRole("dialog");

    overlay = true;
    await waitFor(() =>
      expect(getOnboardingSnapshot().sessionHiddenTips.has("composer-search-memory")).toBe(true)
    );
    await waitFor(() => expect(isTipOpen()).toBe(false));
  });

  test("the Arcadia tip waits on the composer and describes the active recipient", async () => {
    const app = renderLayer({
      pathname: "/sandbox/arcadia/abc",
      children: (
        <div data-multitask-enabled="true">
          <FeatureTip id="arcadia-multiagent">
            <div>
              <button aria-hidden tabIndex={-1} type="button">
                Orchestrator
              </button>
              <button aria-expanded={false} aria-pressed type="button">
                Researcher
              </button>
              <span>0 running</span>
            </div>
          </FeatureTip>
          <form data-onboarding-composer-busy />
        </div>
      ),
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(isTipOpen()).toBe(false);
    app.container.querySelector("form")?.removeAttribute("data-onboarding-composer-busy");

    await app.findByRole("dialog", { name: "Choose who gets your message" });
    const recipient = app.getByRole("button", { name: "Researcher" });

    expect(recipient.hasAttribute("aria-describedby")).toBe(true);
    fireEvent.click(app.getByText("0 running"));
    expect(tipRecord("arcadia-multiagent")).toBeUndefined();
    fireEvent.pointerDown(recipient);
    fireEvent.click(recipient);
    expect(tipRecord("arcadia-multiagent")?.outcome).toBe("acted");
  });

  test("skips automatic tips on the first destination after the welcome", async () => {
    let welcomeShown = true;
    const consumeWelcomeVisit = () => {
      const showed = welcomeShown;
      welcomeShown = false;

      return showed;
    };
    const view = (pathname: string) => (
      <PathnameContext.Provider value={pathname}>
        <OnboardingContext.Provider value={context}>
          <FeatureTip id="composer-search-memory">
            <button type="button">Search</button>
          </FeatureTip>
          <FeatureTipLayer
            anchorProbe={() => true}
            consumeWelcomeVisit={consumeWelcomeVisit}
            overlayProbe={() => false}
            timing={FAST}
          />
        </OnboardingContext.Provider>
      </PathnameContext.Provider>
    );
    const app = render(view("/"));

    app.rerender(view("/chat/first"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(isTipOpen()).toBe(false);

    app.rerender(view("/chat/second"));
    await app.findByRole("dialog", { name: "What informs each reply" });
  });

  test("shows at most one tip per route visit", async () => {
    const app = renderLayer({
      pathname: "/sandbox/arcadia/abc",
      children: (
        <>
          <FeatureTip id="composer-search-memory">
            <button type="button">Search</button>
          </FeatureTip>
          <FeatureTip id="arcadia-multiagent">
            <div>
              <button aria-expanded={false} aria-pressed type="button">
                Orchestrator
              </button>
            </div>
          </FeatureTip>
        </>
      ),
    });

    fireEvent.click(await app.findByRole("button", { name: "Got it" }));
    await waitFor(() => expect(isTipOpen()).toBe(false));

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(isTipOpen()).toBe(false);
    expect(getOnboardingSnapshot().state.tipLog).toHaveLength(1);
  });

  test("closes when its moment passes (showWhen turns false)", async () => {
    function Harness({ show }: { show: boolean }) {
      return (
        <FeatureTip id="composer-search-memory" showWhen={show}>
          <button type="button">Search</button>
        </FeatureTip>
      );
    }

    const app = renderLayer({ children: <Harness show /> });

    await app.findByRole("dialog");
    app.rerender(
      <PathnameContext.Provider value="/chat/abc">
        <OnboardingContext.Provider value={context}>
          <Harness show={false} />
          <FeatureTipLayer anchorProbe={() => true} overlayProbe={() => false} timing={FAST} />
        </OnboardingContext.Provider>
      </PathnameContext.Provider>
    );

    await waitFor(() => expect(isTipOpen()).toBe(false));
  });

  test("nothing shows for ineligible accounts, with tips off, or while the Guide is open", async () => {
    const ineligible = renderLayer({ value: { autoEligible: false } });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(isTipOpen()).toBe(false);
    ineligible.unmount();

    const guide = renderLayer({ value: { guideOpen: true } });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(isTipOpen()).toBe(false);
    guide.unmount();

    await act(async () => {
      await onboardingActions.setTipsEnabled(false);
    });
    renderLayer();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(isTipOpen()).toBe(false);
  });
});

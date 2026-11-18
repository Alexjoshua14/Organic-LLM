import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";

import * as clerk from "@clerk/nextjs";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

// No session id, so admin visibility resolves to false without a network call.
mockModulePreservingReal("@clerk/nextjs", clerk, {
  useAuth: (() => ({ isLoaded: true, isSignedIn: true, userId: "user_guide" })) as never,
});

import { AionLauncherProvider, useAionLauncher } from "@/components/aion-launcher/aion-launcher";
import { GuideTrigger } from "@/components/onboarding/guide-trigger";
import {
  OnboardingContext,
  type GuideTab,
  type OnboardingContextValue,
} from "@/components/onboarding/onboarding-context";
import { OnboardingGuide } from "@/components/onboarding/onboarding-guide";
import { WelcomeCard } from "@/components/onboarding/welcome-card";
import { holdOnboarding } from "@/lib/onboarding/onboarding-blockers";
import { onboardingActions } from "@/lib/onboarding/onboarding-actions";
import {
  connectOnboardingStore,
  getOnboardingSnapshot,
  resetOnboardingStoreForTests,
} from "@/lib/onboarding/onboarding-store";

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

function LauncherState() {
  const { open } = useAionLauncher();

  return <output data-testid="launcher">{open ? "open" : "closed"}</output>;
}

/** Real Guide state wiring, as OnboardingHost provides it, without Clerk. */
function Harness({
  children,
  signedIn = true,
  autoEligible = true,
}: {
  children?: ReactNode;
  signedIn?: boolean;
  autoEligible?: boolean;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<GuideTab>("start");
  const value: OnboardingContextValue = {
    autoEligible,
    signedIn,
    guideOpen,
    guideTab,
    openGuide: (tab = "start") => {
      setGuideTab(tab);
      setGuideOpen(true);
    },
    setGuideOpen,
    setGuideTab,
  };

  return (
    <AionLauncherProvider>
      <OnboardingContext.Provider value={value}>
        <GuideTrigger />
        {children}
        <OnboardingGuide />
        <LauncherState />
      </OnboardingContext.Provider>
    </AionLauncherProvider>
  );
}

beforeEach(() => {
  connectOnboardingStore("user_guide", {
    local: memoryStorage(),
    session: memoryStorage(),
    target: null,
  });
});

afterEach(() => {
  cleanup();
  resetOnboardingStoreForTests();
});

async function openGuide(app: ReturnType<typeof render>) {
  fireEvent.click(app.getByRole("button", { name: /open the guide/i }));

  return app.findByRole("dialog", { name: "Guide" });
}

describe("Guide", () => {
  test("opens from ? on Start here with first steps and the surfaces this account can use", async () => {
    const app = render(<Harness />);
    const guide = await openGuide(app);

    expect(within(guide).getByRole("tab", { name: "Start here", selected: true })).toBeTruthy();
    expect(within(guide).getByText("0 of 4 done")).toBeTruthy();
    expect(within(guide).getByText("Ask your first question")).toBeTruthy();
    expect(within(guide).getByRole("link", { name: /^Rabbit Holes/ })).toBeTruthy();
    expect(within(guide).queryByText("Noesis")).toBeNull();
    // One close control: the dialog's own.
    expect(within(guide).getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  test("Escape restores focus to the persistent Guide trigger", async () => {
    const app = render(<Harness />);
    const trigger = app.getByRole("button", { name: /open the guide/i });

    trigger.focus();
    const guide = await openGuide(app);

    await act(async () => fireEvent.keyDown(guide, { key: "Escape" }));
    await waitFor(() => {
      expect(document.activeElement === trigger).toBe(true);
    });
  });

  test("first steps reflect real actions and can be hidden", async () => {
    const app = render(<Harness />);
    const guide = await openGuide(app);

    await act(async () => {
      await onboardingActions.completeStep("first-message");
    });
    expect(within(guide).getByText("1 of 4 done")).toBeTruthy();
    expect(within(guide).getByText(/Ask your first question/).textContent).toContain("(done)");

    fireEvent.click(within(guide).getByRole("button", { name: "Hide" }));
    expect(within(guide).getByText(/First steps are hidden/)).toBeTruthy();
    fireEvent.click(within(guide).getByRole("button", { name: "Show them" }));
    expect(within(guide).getByText("1 of 4 done")).toBeTruthy();
  });

  test("the launcher step closes the Guide and opens the launcher", async () => {
    const app = render(<Harness />);
    const guide = await openGuide(app);

    fireEvent.click(within(guide).getByRole("button", { name: "Open launcher" }));

    await waitFor(() => expect(app.queryByRole("dialog", { name: "Guide" })).toBeNull());
    expect(app.getByTestId("launcher").textContent).toBe("open");
    // Opening the launcher is the real action for that step.
    expect(getOnboardingSnapshot().state.checklist.done["switch-ideas"]).toBeNumber();
  });

  test("Shortcuts are labelled for this platform and hide Ctrl-only bindings off Apple", async () => {
    const app = render(<Harness />);
    const guide = await openGuide(app);

    fireEvent.mouseDown(within(guide).getByRole("tab", { name: "Shortcuts" }));
    fireEvent.click(within(guide).getByRole("tab", { name: "Shortcuts" }));

    expect(await within(guide).findByText("Switch ideas")).toBeTruthy();
    expect(within(guide).getByRole("img", { name: "Control K" })).toBeTruthy();
    expect(within(guide).queryByText("Show or hide the agent board")).toBeNull();
  });

  test("Tips lists every tip, toggles tips and replays onboarding", async () => {
    act(() => {
      onboardingActions.tipSeen("composer-search-memory", 2, "dismissed");
      onboardingActions.dismissWelcome();
    });

    const app = render(<Harness />);
    const guide = await openGuide(app);

    fireEvent.mouseDown(within(guide).getByRole("tab", { name: "Tips" }));
    fireEvent.click(within(guide).getByRole("tab", { name: "Tips" }));

    expect(await within(guide).findByText("What informs each reply")).toBeTruthy();
    expect(within(guide).getByText("Choose who hears you")).toBeTruthy();

    fireEvent.click(within(guide).getByRole("switch"));
    expect(getOnboardingSnapshot().state.tipsEnabled).toBe(false);

    await act(async () =>
      fireEvent.click(within(guide).getByRole("button", { name: /replay onboarding/i }))
    );

    const state = getOnboardingSnapshot().state;

    expect(state.tipsEnabled).toBe(true);
    expect(state.tips).toEqual({});
    expect(state.welcomeDismissedAt).toBeUndefined();
    expect(state.replayRequestedAt).toBeNumber();
  });

  test("signed out: no first steps and no tip controls", async () => {
    const app = render(<Harness signedIn={false} />);
    const guide = await openGuide(app);

    expect(within(guide).queryByText(/of 4 done/)).toBeNull();
    expect(within(guide).getByText(/Sign in to start/)).toBeTruthy();

    fireEvent.mouseDown(within(guide).getByRole("tab", { name: "Tips" }));
    fireEvent.click(within(guide).getByRole("tab", { name: "Tips" }));

    expect(await within(guide).findByText("What informs each reply")).toBeTruthy();
    expect(within(guide).queryByRole("switch")).toBeNull();
  });
});

describe("WelcomeCard", () => {
  test("replay brings back the welcome even after all steps are done", () => {
    for (const step of ["first-message", "try-arcadia", "rabbit-hole", "switch-ideas"] as const) {
      void onboardingActions.completeStep(step);
    }

    const app = render(
      <Harness>
        <WelcomeCard />
      </Harness>
    );

    expect(app.queryByText("Welcome to Organic")).toBeNull();
    act(() => {
      void onboardingActions.replay();
    });
    expect(app.getByText("Welcome to Organic")).toBeTruthy();
  });

  test("shows for a new account and opens the Guide, which retires it", async () => {
    const app = render(
      <Harness>
        <WelcomeCard />
      </Harness>
    );

    const card = app.getByRole("complementary", { name: "Welcome to Organic" });

    fireEvent.click(within(card).getByRole("button", { name: "Open the Guide" }));

    expect(await app.findByRole("dialog", { name: "Guide" })).toBeTruthy();
    expect(app.queryByRole("complementary", { name: "Welcome to Organic" })).toBeNull();
    expect(getOnboardingSnapshot().state.welcomeDismissedAt).toBeNumber();
  });

  test("one X dismisses it for good", () => {
    const app = render(
      <Harness>
        <WelcomeCard />
      </Harness>
    );

    fireEvent.click(app.getByRole("button", { name: "Dismiss welcome" }));

    expect(app.queryByRole("complementary", { name: "Welcome to Organic" })).toBeNull();
  });

  test("stays away for older accounts, while another notice is up, and once first steps are done", () => {
    const older = render(
      <Harness autoEligible={false}>
        <WelcomeCard />
      </Harness>
    );

    expect(older.queryByRole("complementary")).toBeNull();
    older.unmount();

    const release = holdOnboarding("test-notice");
    const held = render(
      <Harness>
        <WelcomeCard />
      </Harness>
    );

    expect(held.queryByRole("complementary")).toBeNull();
    act(() => release());
    expect(held.getByRole("complementary", { name: "Welcome to Organic" })).toBeTruthy();

    act(() => {
      for (const step of ["first-message", "try-arcadia", "rabbit-hole", "switch-ideas"] as const) {
        onboardingActions.completeStep(step);
      }
    });
    expect(held.queryByRole("complementary")).toBeNull();
  });
});

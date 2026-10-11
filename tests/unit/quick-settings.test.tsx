import { afterEach, beforeEach, expect, jest, mock, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import * as clerk from "@clerk/nextjs";
import * as navigation from "next/navigation";
import * as settingsPersistence from "@/data/supabase/user-settings";

import { SettingsOverlay } from "@/components/settings/SettingsOverlay";
import { KnowledgeCacheProvider } from "@/hooks/use-knowledge-cache";
import { ThrottledThemeProvider } from "@/lib/theme/ThrottledThemeProvider";
import * as userSettings from "@/lib/user-settings";
import { defaultUserSettings, type UserSettings } from "@/lib/schemas/userSettings";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

let pathname: string;
let restoreClerk: () => void;
let restoreNavigation: () => void;
let restorePersistence: () => void;
let restoreSettings: () => void;
let settings: UserSettings;
const persist = mock(async () => {});

beforeEach(() => {
  jest.useFakeTimers();
  pathname = "/chat";
  settings = defaultUserSettings();
  restoreSettings = mockModulePreservingReal("@/lib/user-settings", userSettings, {
    getSettings: () => settings,
    setSettings: (partial) => (settings = { ...settings, ...partial }),
  });
  persist.mockClear();
  restoreClerk = mockModulePreservingReal("@clerk/nextjs", clerk, {
    useAuth: (() => ({ userId: "quick-settings-user", isLoaded: true })) as never,
    useUser: (() => ({ user: null })) as never,
  });
  restoreNavigation = mockModulePreservingReal("next/navigation", navigation, {
    usePathname: () => pathname,
  });
  restorePersistence = mockModulePreservingReal(
    "@/data/supabase/user-settings",
    settingsPersistence,
    { persistUserSettingsToSupabase: persist as never }
  );
});

afterEach(() => {
  cleanup();
  restoreClerk();
  restoreNavigation();
  restorePersistence();
  restoreSettings();
  jest.useRealTimers();
});

async function openSettings() {
  let view!: ReturnType<typeof render>;
  const onOpenChange = mock(() => {});
  await act(async () => {
    view = render(
      <KnowledgeCacheProvider>
        <ThrottledThemeProvider>
          <SettingsOverlay open onOpenChange={onOpenChange} />
        </ThrottledThemeProvider>
      </KnowledgeCacheProvider>
    );
  });
  return { ...view, onOpenChange };
}

async function advance(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
}

function pointer(target: Element, type: string, pointerType = "mouse") {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(target, event);
}

const coalescenceCaption = "Unlock Organic’s full potential by connecting its features.";

test("captions are hidden initially, including Theme, and every feature label can reveal its caption", async () => {
  const view = await openSettings();
  const captions = [
    ["Theme", "System / Light / Dark"],
    ["Coalescence Mode", coalescenceCaption],
    ["Arcadia preview (experimental)", "Markdown preview toggle on the Arcadia composer."],
    ["Context effort (beta)", /When on, Arcadia shows a slider/],
    ["Tips & coachmarks", /Re-show surface tips you dismissed/],
  ] as const;

  for (const [label, caption] of captions) {
    expect(view.queryByText(caption)).toBeNull();
    const trigger = view.getByRole("button", { name: `About ${label}` });
    await act(async () => fireEvent.click(trigger));
    expect(view.getByText(caption)).toBeTruthy();
    await act(async () => fireEvent.click(trigger));
    expect(view.queryByText(caption)).toBeNull();
  }
  expect(view.queryByRole("button", { name: "About Ergon background" })).toBeNull();
  expect(persist).not.toHaveBeenCalled();
});

test("a hovered caption stays readable across the gap, then closes without moving focus", async () => {
  const view = await openSettings();
  const trigger = view.getByRole("button", { name: "About Coalescence Mode" });
  const focused = document.activeElement;
  await act(async () => pointer(trigger, "pointerover"));
  const caption = view.getByRole("dialog", { name: "About Coalescence Mode" });
  expect(document.activeElement).toBe(focused);
  await act(async () => pointer(trigger, "pointerout"));
  await advance(60);
  await act(async () => pointer(caption, "pointerover"));
  await advance(500);
  expect(view.getByText(coalescenceCaption)).toBeTruthy();
  await act(async () => pointer(caption, "pointerout"));
  await advance(200);
  expect(view.queryByText(coalescenceCaption)).toBeNull();
  expect(document.activeElement).toBe(focused);
});

test("touch opens a pinned caption without toggling; outside interaction dismisses it and the switch still saves", async () => {
  const view = await openSettings();
  const trigger = view.getByRole("button", { name: "About Coalescence Mode" });
  const initialValue = settings.coalescenceMode;
  await act(async () => {
    pointer(trigger, "pointerover", "touch");
    pointer(trigger, "pointerdown", "touch");
    trigger.focus();
  });
  expect(view.queryByText(coalescenceCaption)).toBeNull();
  await act(async () => fireEvent.click(trigger));
  await act(async () => pointer(trigger, "pointerout", "touch"));
  await advance(200);
  expect(view.getByText(coalescenceCaption)).toBeTruthy();
  expect(settings.coalescenceMode).toBe(initialValue);
  expect(persist).not.toHaveBeenCalled();

  const toggle = view.getByRole("switch", { name: "Coalescence Mode" });
  await act(async () => {
    pointer(toggle, "pointerdown");
    fireEvent.click(toggle);
  });
  expect(view.queryByText(coalescenceCaption)).toBeNull();
  expect(settings.coalescenceMode).toBe(!initialValue);
  expect(persist).toHaveBeenCalledWith("quick-settings-user", settings);
});

test("keyboard focus reveals the caption and Escape closes it without closing the sheet", async () => {
  const view = await openSettings();
  const trigger = view.getByRole("button", { name: "About Coalescence Mode" });
  await act(async () => trigger.focus());
  expect(view.getByText(coalescenceCaption)).toBeTruthy();
  expect(
    view.getByRole("button", { name: "About Coalescence Mode", description: coalescenceCaption })
  ).toBe(trigger);
  await act(async () => fireEvent.keyDown(trigger, { key: "Escape" }));
  expect(view.queryByText(coalescenceCaption)).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(view.onOpenChange).not.toHaveBeenCalled();
});

test("Ergon's route-specific option retains its caption and setting", async () => {
  pathname = "/ergon/tasks";
  const view = await openSettings();
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "About Ergon background" }))
  );
  expect(view.getByText("Animated liquid chrome behind the task list.")).toBeTruthy();
  const initialValue = settings.ergonLiquidChrome;
  await act(async () =>
    fireEvent.click(view.getByRole("switch", { name: "Ergon liquid chrome background" }))
  );
  expect(settings.ergonLiquidChrome).toBe(!initialValue);
});

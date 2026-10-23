import { describe, expect, test, afterEach, beforeEach, mock } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { ChatStylePicker } from "@/components/chat/chat-style-picker";
import { CHAT_STYLES } from "@/lib/chat/chat-style";
import { getChatStyle, setChatStyle } from "@/lib/chat/chat-style-store";
import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";
import { render } from "../helpers/render";

const THREAD_UUID = "00000000-0000-4000-8000-000000000099";

const originalFetch = globalThis.fetch;

function renderPicker(ui: ReactNode) {
  return render(ui, {
    wrapper: ({ children }) => (
      <FeatureHintRegistryProvider>{children}</FeatureHintRegistryProvider>
    ),
  });
}

beforeEach(() => {
  setChatStyle(THREAD_UUID, "default");
  globalThis.fetch = mock(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { arcadiaStarterKey: string | null };
    return new Response(JSON.stringify({ arcadiaStarterKey: body.arcadiaStarterKey }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("ChatStylePicker", () => {
  test("renders all chat styles", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    expect(getByText("Standard")).toBeTruthy();
    expect(getByText("Ergon board")).toBeTruthy();
    expect(getByText("Remy")).toBeTruthy();
    expect(getByText("Scribe")).toBeTruthy();
    expect(getByText("Jev")).toBeTruthy();
  });

  test("renders one radio per chat style, in order", () => {
    const { getAllByRole } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    const radios = getAllByRole("radio");

    expect(radios).toHaveLength(CHAT_STYLES.length);
    CHAT_STYLES.forEach((style, index) => {
      expect(radios[index]!.textContent).toContain(style.label);
    });
  });

  test("grid fits five cards on one lg row and spans an odd last card when narrow", () => {
    const { getByRole } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    const grid = getByRole("radiogroup", { name: "Chat style" });

    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-5");
    expect(grid.className).toContain("max-lg:[&>*:last-child:nth-child(odd)]:col-span-2");
  });

  test("selecting Ergon updates the chat-style store", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    fireEvent.click(getByText("Ergon board"));
    expect(getChatStyle(THREAD_UUID)).toBe("ergon");
  });

  test("selecting Scribe updates the chat-style store", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    fireEvent.click(getByText("Scribe"));
    expect(getChatStyle(THREAD_UUID)).toBe("scribe");
  });

  test("selecting Jev updates the chat-style store and shows Jev starters", () => {
    const { getByText, getByRole } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    fireEvent.click(getByText("Jev"));

    expect(getChatStyle(THREAD_UUID)).toBe("jev");
    expect(getByRole("radio", { name: /Jev/i }).getAttribute("aria-checked")).toBe("true");
    expect(getByText("I'm away from the screen — answer out loud when you can.")).toBeTruthy();
    expect(getByText("Show me, don't tell me — diagrams and boards over prose.")).toBeTruthy();
    expect(getByText("I'm thinking out loud — only reply when I ask for something.")).toBeTruthy();
  });

  test("arrow keys wrap between Standard and Jev", () => {
    const { getByRole } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    const grid = getByRole("radiogroup", { name: "Chat style" });

    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    expect(getChatStyle(THREAD_UUID)).toBe("jev");

    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(getChatStyle(THREAD_UUID)).toBe("default");
  });

  test("default style is selected initially", () => {
    const { getByRole } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    const standard = getByRole("radio", { name: /Standard/i });
    expect(standard.getAttribute("aria-checked")).toBe("true");
  });

  test("style cards are tab stops; launchpad starters are not", () => {
    const { getAllByRole } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);

    const styleTabs = getAllByRole("radio").map((node) => node.getAttribute("tabindex"));
    expect(styleTabs).toEqual(CHAT_STYLES.map(() => "0"));

    const starterButtons = getAllByRole("button").filter((node) =>
      node.hasAttribute("aria-pressed")
    );
    expect(starterButtons.length).toBeGreaterThan(0);
    expect(starterButtons.every((node) => node.getAttribute("tabindex") === "-1")).toBe(true);
  });

  test("shows starter prompts for the selected style", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    expect(getByText("Help me think through this step by step.")).toBeTruthy();
  });

  test("starter prompts update when style changes", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    fireEvent.click(getByText("Ergon board"));
    expect(getByText("Set up a kanban board for this project.")).toBeTruthy();
  });

  test("toggling a starter selects encoded key via onStarterKeyChange", async () => {
    const changes: (string | null)[] = [];
    const { getByText } = renderPicker(
      <ChatStylePicker
        chatId={THREAD_UUID}
        starterKey={null}
        onStarterKeyChange={(key) => changes.push(key)}
      />
    );

    fireEvent.click(getByText("Help me think through this step by step."));

    await waitFor(() => expect(changes).toContain("default:think-step-by-step"));
  });

  test("toggling selected starter clears the key", async () => {
    const changes: (string | null)[] = [];
    const { getByText } = renderPicker(
      <ChatStylePicker
        chatId={THREAD_UUID}
        starterKey="default:think-step-by-step"
        onStarterKeyChange={(key) => changes.push(key)}
      />
    );

    fireEvent.click(getByText("Help me think through this step by step."));

    await waitFor(() => expect(changes).toContain(null));
  });

  test("scribe Stitch This Together selects stable scribe key", async () => {
    const changes: (string | null)[] = [];
    const { getByText } = renderPicker(
      <ChatStylePicker
        chatId={THREAD_UUID}
        starterKey={null}
        onStarterKeyChange={(key) => changes.push(key)}
      />
    );

    fireEvent.click(getByText("Scribe"));
    fireEvent.click(getByText("Stitch This Together"));

    await waitFor(() => expect(changes).toContain("scribe:stitch-this-together"));
  });

  test("Jev starter selects stable jev key", async () => {
    const changes: (string | null)[] = [];
    const { getByText } = renderPicker(
      <ChatStylePicker
        chatId={THREAD_UUID}
        starterKey={null}
        onStarterKeyChange={(key) => changes.push(key)}
      />
    );

    fireEvent.click(getByText("Jev"));
    fireEvent.click(getByText("I'm thinking out loud — only reply when I ask for something."));

    await waitFor(() => expect(changes).toContain("jev:thinking-out-loud"));
  });
});

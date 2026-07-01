import { describe, expect, test, afterEach, beforeEach, mock } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { ChatStylePicker } from "@/components/chat/chat-style-picker";
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
    expect(getByText("Scribe")).toBeTruthy();
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

  test("default style is selected initially", () => {
    const { getByRole } = renderPicker(<ChatStylePicker chatId={THREAD_UUID} />);
    const standard = getByRole("radio", { name: /Standard/i });
    expect(standard.getAttribute("aria-checked")).toBe("true");
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
});

import { describe, expect, test, afterEach, beforeEach } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import { ChatStylePicker } from "@/components/chat/chat-style-picker";
import { getChatStyle, setChatStyle } from "@/lib/chat/chat-style-store";
import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";
import { render } from "../helpers/render";

const THREAD_ID = "picker-test-thread";

function renderPicker(ui: ReactNode) {
  return render(ui, {
    wrapper: ({ children }) => (
      <FeatureHintRegistryProvider>{children}</FeatureHintRegistryProvider>
    ),
  });
}

beforeEach(() => setChatStyle(THREAD_ID, "default"));
afterEach(() => cleanup());

describe("ChatStylePicker", () => {
  test("renders all chat styles", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_ID} />);
    expect(getByText("Standard")).toBeTruthy();
    expect(getByText("Ergon board")).toBeTruthy();
    expect(getByText("Scribe")).toBeTruthy();
  });

  test("selecting Ergon updates the chat-style store", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_ID} />);
    fireEvent.click(getByText("Ergon board"));
    expect(getChatStyle(THREAD_ID)).toBe("ergon");
  });

  test("selecting Scribe updates the chat-style store", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_ID} />);
    fireEvent.click(getByText("Scribe"));
    expect(getChatStyle(THREAD_ID)).toBe("scribe");
  });

  test("default style is selected initially", () => {
    const { getByRole } = renderPicker(<ChatStylePicker chatId={THREAD_ID} />);
    const standard = getByRole("radio", { name: /Standard/i });
    expect(standard.getAttribute("aria-checked")).toBe("true");
  });

  test("shows starter prompts for the selected style", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_ID} />);
    expect(getByText("Help me think through this step by step.")).toBeTruthy();
  });

  test("starter prompts update when style changes", () => {
    const { getByText } = renderPicker(<ChatStylePicker chatId={THREAD_ID} />);
    fireEvent.click(getByText("Ergon board"));
    expect(getByText("Set up a kanban board for this project.")).toBeTruthy();
  });

  test("calls onStarterSelect when a starter prompt is clicked", () => {
    let injected = "";
    const { getByText } = renderPicker(
      <ChatStylePicker
        chatId={THREAD_ID}
        onStarterSelect={(text) => {
          injected = text;
        }}
      />
    );
    fireEvent.click(getByText("Help me think through this step by step."));
    expect(injected).toBe("Help me think through this step by step.");
  });

  test("scribe Stitch This Together injects full prompt from chip label", () => {
    let injected = "";
    const { getByText } = renderPicker(
      <ChatStylePicker
        chatId={THREAD_ID}
        onStarterSelect={(text) => {
          injected = text;
        }}
      />
    );
    fireEvent.click(getByText("Scribe"));
    fireEvent.click(getByText("Stitch This Together"));
    expect(injected).toContain("directly stitch my pieces together");
    expect(injected).toContain("Do not scope creep");
  });
});

import { describe, expect, test } from "bun:test";
import { render, within } from "@testing-library/react";

import { VoiceLiveBar } from "@/components/voice/voice-live-bar";
import { VoiceSeesChip } from "@/components/voice/voice-sees-chip";
import { ensureDom } from "../helpers/render";

ensureDom();

const snapshot = {
  surfaceKey: "chat:t1:m4",
  label: "Chat · Espresso grinders",
  body: 'The user has the chat "Espresso grinders" open.',
  at: 0,
};

function bar(props: Partial<Parameters<typeof VoiceLiveBar>[0]> = {}) {
  const view = render(
    <VoiceLiveBar
      connecting={false}
      localStream={null}
      phase="idle"
      remoteStream={null}
      startedAt={null}
      onEnd={() => undefined}
      {...props}
    />
  );

  return { ...view, ui: within(view.container) };
}

describe("VoiceSeesChip", () => {
  test("names what voice was last told about", () => {
    const view = render(<VoiceSeesChip context={snapshot} />);

    expect(
      within(view.container).getByRole("button", { name: "Voice sees: Chat · Espresso grinders" })
    ).toBeTruthy();
    view.unmount();
  });

  test("says why when there was nothing to describe", () => {
    const view = render(
      <VoiceSeesChip context={{ ...snapshot, label: "Chat", body: "", reason: "not-owner" }} />
    );

    expect(within(view.container).getByText("· not-owner")).toBeTruthy();
    view.unmount();
  });

  test("before any push it says so rather than showing nothing", () => {
    const view = render(<VoiceSeesChip context={null} />);

    expect(
      within(view.container).getByRole("button", { name: "Voice sees: nothing yet" })
    ).toBeTruthy();
    view.unmount();
  });
});

describe("VoiceLiveBar sees chip", () => {
  test("absent unless the host passes it — the host only does in development", () => {
    const { container, unmount } = bar();

    expect(container.querySelector("[data-voice-sees]")).toBeNull();
    unmount();
  });

  test("shown on a live bar when passed", () => {
    const { ui, unmount } = bar({ sees: snapshot });

    expect(ui.getByRole("button", { name: "Voice sees: Chat · Espresso grinders" })).toBeTruthy();
    unmount();
  });

  test("hidden while paused or connecting, when voice sees nothing", () => {
    for (const state of [{ paused: true }, { connecting: true }]) {
      const { container, unmount } = bar({ sees: snapshot, ...state });

      expect(container.querySelector("[data-voice-sees]")).toBeNull();
      unmount();
    }
  });
});

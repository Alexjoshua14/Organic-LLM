import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";

import { VoiceLiveBar } from "@/components/voice/voice-live-bar";
import { ensureDom } from "../helpers/render";

ensureDom();

function bar(props: Partial<Parameters<typeof VoiceLiveBar>[0]> = {}) {
  const onEnd = mock(() => undefined);
  const onResume = mock(() => undefined);

  const view = render(
    <VoiceLiveBar
      connecting={false}
      localStream={null}
      phase="idle"
      remoteStream={null}
      startedAt={null}
      onEnd={onEnd}
      onResume={onResume}
      {...props}
    />
  );

  // Scoped to this render: other suites reinstall jsdom, so the global `screen` can point elsewhere.
  return { ...view, ui: within(view.container), onEnd, onResume };
}

describe("VoiceLiveBar paused", () => {
  test("says the mic is off, in words and to screen readers", () => {
    const { container, ui, unmount } = bar({ paused: true });

    expect(ui.getByText("Paused · mic off")).toBeTruthy();
    expect(ui.getByText("Voice paused — microphone off")).toBeTruthy();
    expect(container.querySelector("[data-voice-paused]")).not.toBeNull();
    unmount();
  });

  test("drops the live waveform, which would claim the mic is open", () => {
    // The ribbon is the only SVG that stretches; lucide icons keep their aspect ratio.
    const ribbon = 'svg[preserveAspectRatio="none"]';
    const live = bar();

    expect(live.container.querySelector(ribbon)).not.toBeNull();
    live.unmount();

    const { container, unmount } = bar({ paused: true });

    expect(container.querySelector(ribbon)).toBeNull();
    unmount();
  });

  test("offers resume, and still lets the user end it", () => {
    const { onEnd, onResume, ui, unmount } = bar({ paused: true });

    fireEvent.click(ui.getByRole("button", { name: "Resume voice session" }));
    fireEvent.click(ui.getByRole("button", { name: "End voice session" }));

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    unmount();
  });

  test("does not claim to be merely paused after a resume failed", () => {
    const { ui, unmount } = bar({ paused: true, resumeError: "Speak Realtime budget exceeded" });

    expect(ui.getByText("Couldn’t resume")).toBeTruthy();
    expect(ui.getByRole("button", { name: "Resume voice session" }).title).toBe(
      "Speak Realtime budget exceeded"
    );
    unmount();
  });

  test("a resume in flight shows as connecting, not paused", () => {
    const { container, ui, unmount } = bar({ paused: true, connecting: true });

    expect(container.querySelector("[data-voice-paused]")).toBeNull();
    expect(ui.getByText("Connecting voice session")).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Resume voice session" })).toBeNull();
    unmount();
  });

  test("the live bar has no resume control", () => {
    const { ui, unmount } = bar();

    expect(ui.queryByRole("button", { name: "Resume voice session" })).toBeNull();
    unmount();
  });
});

import { describe, expect, test } from "bun:test";

import { replayHotkeyAction } from "@/components/showcase/replay/use-replay-hotkeys";

type KeyInit = {
  key: string;
  target?: EventTarget | null;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
};

function key({ key, target = document.body, ...rest }: KeyInit) {
  return {
    key,
    target,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    defaultPrevented: false,
    ...rest,
  };
}

function element(html: string, selector: string): HTMLElement {
  const host = document.createElement("div");

  host.innerHTML = html;
  document.body.appendChild(host);

  return host.querySelector(selector) as HTMLElement;
}

describe("replayHotkeyAction", () => {
  test("maps play, restart, and chapter keys from the page", () => {
    expect(replayHotkeyAction(key({ key: " " }), 0, 3)).toEqual({ type: "toggle" });
    expect(replayHotkeyAction(key({ key: "k" }), 0, 3)).toEqual({ type: "toggle" });
    expect(replayHotkeyAction(key({ key: "R" }), 0, 3)).toEqual({ type: "restart" });
    expect(replayHotkeyAction(key({ key: "ArrowRight" }), 0, 3)).toEqual({
      type: "chapter",
      index: 1,
    });
    expect(replayHotkeyAction(key({ key: "ArrowLeft" }), 2, 3)).toEqual({
      type: "chapter",
      index: 1,
    });
    expect(replayHotkeyAction(key({ key: "3" }), 0, 3)).toEqual({ type: "chapter", index: 2 });
  });

  test("ignores out-of-range chapters and modified chords", () => {
    expect(replayHotkeyAction(key({ key: "ArrowLeft" }), 0, 3)).toBeNull();
    expect(replayHotkeyAction(key({ key: "ArrowRight" }), 2, 3)).toBeNull();
    expect(replayHotkeyAction(key({ key: "4" }), 0, 3)).toBeNull();
    expect(replayHotkeyAction(key({ key: "r", metaKey: true }), 0, 3)).toBeNull();
    expect(replayHotkeyAction(key({ key: " ", defaultPrevented: true }), 0, 3)).toBeNull();
  });

  test("leaves text entry alone", () => {
    const input = element('<input type="text" />', "input");
    const area = element("<textarea></textarea>", "textarea");

    expect(replayHotkeyAction(key({ key: " ", target: input }), 0, 3)).toBeNull();
    expect(replayHotkeyAction(key({ key: "r", target: area }), 0, 3)).toBeNull();
  });

  test("lets focused controls keep their native keys", () => {
    const button = element("<button>Go</button>", "button");
    const range = element('<input type="range" />', "input");
    const checkbox = element('<input type="checkbox" />', "input");

    expect(replayHotkeyAction(key({ key: " ", target: button }), 0, 3)).toBeNull();
    expect(replayHotkeyAction(key({ key: " ", target: checkbox }), 0, 3)).toBeNull();
    expect(replayHotkeyAction(key({ key: "ArrowRight", target: range }), 0, 3)).toBeNull();
    // A non-native key on a button still drives the replay.
    expect(replayHotkeyAction(key({ key: "r", target: button }), 0, 3)).toEqual({
      type: "restart",
    });
  });

  test("defers to open overlays", () => {
    const item = element('<div role="dialog"><span tabindex="0">x</span></div>', "span");

    expect(replayHotkeyAction(key({ key: "r", target: item }), 0, 3)).toBeNull();
  });
});

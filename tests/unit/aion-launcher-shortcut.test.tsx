import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { AionLauncherProvider, useAionLauncher } from "@/components/aion-launcher/aion-launcher";
import { render } from "../helpers/render";

afterEach(cleanup);

function Probe() {
  const { open } = useAionLauncher();

  return (
    <>
      <output data-testid="open">{String(open)}</output>
      <textarea aria-label="composer" />
      <input aria-label="field" />
      {/* jsdom does not implement isContentEditable, so the editor flag is set by hand. */}
      <div aria-label="editor" data-testid="editor" tabIndex={0} />
    </>
  );
}

function setup() {
  const view = render(
    <AionLauncherProvider>
      <Probe />
    </AionLauncherProvider>
  );

  return { ...view, isOpen: () => view.getByTestId("open").textContent };
}

describe("AionLauncherProvider shortcut", () => {
  test("⌘K and Ctrl+K toggle the launcher", () => {
    const { isOpen } = setup();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(isOpen()).toBe("true");
    fireEvent.keyDown(window, { key: "K", ctrlKey: true });
    expect(isOpen()).toBe("false");
  });

  test("works from the chat composer, where a switch starts", () => {
    const { getByLabelText, isOpen } = setup();

    fireEvent.keyDown(getByLabelText("composer"), { key: "k", metaKey: true });
    expect(isOpen()).toBe("true");
  });

  test("works from a plain input, and closes from inside the launcher's own field", () => {
    const { getByLabelText, isOpen } = setup();

    fireEvent.keyDown(getByLabelText("field"), { key: "k", ctrlKey: true });
    expect(isOpen()).toBe("true");
    fireEvent.keyDown(getByLabelText("composer"), { key: "k", ctrlKey: true });
    expect(isOpen()).toBe("false");
  });

  test("a rich-text editor keeps its own ⌘K", () => {
    const { getByTestId, isOpen } = setup();
    const editor = getByTestId("editor");

    Object.defineProperty(editor, "isContentEditable", { value: true });
    fireEvent.keyDown(editor, { key: "k", metaKey: true });
    expect(isOpen()).toBe("false");
  });

  test("ignores other chords", () => {
    const { isOpen } = setup();

    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "k", metaKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(isOpen()).toBe("false");
  });
});

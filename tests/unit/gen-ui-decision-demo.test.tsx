import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import { DECISION_DEMO_INTERVAL_MS, GenUiDecisionDemo, GenUiDecisionDemoToolbar, useGenUiDecisionDemo } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiDecisionDemo";
import { FIXTURE_DECISION_MATRIX } from "@/lib/schemas/gen-ui/fixtures";
import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

function DemoHarness({ active = true }: { active?: boolean }) {
  const demo = useGenUiDecisionDemo(active);

  return (
    <section>
      <GenUiDecisionDemoToolbar demo={demo} />
      <div data-testid="preview-canvas">
        <GenUiDecisionDemo block={block} demo={demo} />
      </div>
    </section>
  );
}

const block = FIXTURE_DECISION_MATRIX as DecisionMatrixBlock;
let restoreMedia: () => void;
let hiddenDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  restoreMedia = installBrowserMedia();
  hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  restoreMedia();
  if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
  else Reflect.deleteProperty(document, "hidden");
});

const advance = () => act(() => jest.advanceTimersByTime(DECISION_DEMO_INTERVAL_MS));

describe("Gen UI comparison arrangement demo", () => {
  test("manual navigation wraps through all five arrangements and retains the same input", () => {
    const view = render(<DemoHarness />);
    const question = block.question;
    expect(view.getByLabelText("Arrangement 1 of 5")).toBeTruthy();
    expect(view.getByText(question)).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Previous arrangement" }));
    expect(view.getByLabelText("Arrangement 5 of 5")).toBeTruthy();
    expect(view.getByText("Compact briefing")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Next arrangement" }));
    expect(view.getByLabelText("Arrangement 1 of 5")).toBeTruthy();
    expect(view.getByText(question)).toBeTruthy();
    expect(view.getByRole("button", { name: "Auto" }).getAttribute("aria-pressed")).toBe("false");
    advance();
    expect(view.getByLabelText("Arrangement 1 of 5")).toBeTruthy();
  });

  test("auto is explicit, pauses on hover and hidden tabs, and manual stepping turns it off", () => {
    const view = render(<DemoHarness />);
    fireEvent.click(view.getByRole("button", { name: "Auto" }));
    advance();
    expect(view.getByLabelText("Arrangement 2 of 5")).toBeTruthy();
    const host = view.getByTestId("preview-canvas").firstElementChild!;
    fireEvent.pointerEnter(host);
    advance();
    expect(view.getByLabelText("Arrangement 2 of 5")).toBeTruthy();
    fireEvent.pointerLeave(host);
    advance();
    expect(view.getByLabelText("Arrangement 3 of 5")).toBeTruthy();
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance();
    expect(view.getByLabelText("Arrangement 3 of 5")).toBeTruthy();
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    fireEvent.click(view.getByRole("button", { name: "Next arrangement" }));
    expect(view.getByRole("button", { name: "Auto" }).getAttribute("aria-pressed")).toBe("false");
    advance();
    expect(view.getByLabelText("Arrangement 4 of 5")).toBeTruthy();
  });

  test("auto pauses while interacting with the actual component and clears its timer on unmount", () => {
    const view = render(<DemoHarness />);
    fireEvent.click(view.getByRole("button", { name: "Auto" }));
    const preview = view.getByTestId("preview-canvas").firstElementChild!;
    fireEvent.focus(preview);
    advance();
    expect(view.getByLabelText("Arrangement 1 of 5")).toBeTruthy();
    fireEvent.blur(preview);
    advance();
    expect(view.getByLabelText("Arrangement 2 of 5")).toBeTruthy();
    const clear = jest.spyOn(window, "clearInterval");
    view.unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
  test("controls keep their identity and focus outside the changing preview", () => {
    const view = render(<DemoHarness />);
    const next = view.getByRole("button", { name: "Next arrangement" });
    const canvas = view.getByTestId("preview-canvas");

    next.focus();
    for (let index = 0; index < 5; index++) {
      fireEvent.click(next);
      expect(view.getByRole("button", { name: "Next arrangement" })).toBe(next);
      expect(canvas.contains(next)).toBe(false);
      expect(document.activeElement).toBe(next);
    }
  });

  test("auto pauses when the comparison is not the selected gallery component", () => {
    const view = render(<DemoHarness />);
    fireEvent.click(view.getByRole("button", { name: "Auto" }));
    advance();
    expect(view.getByLabelText("Arrangement 2 of 5")).toBeTruthy();
    view.rerender(<DemoHarness active={false} />);
    advance();
    expect(view.getByLabelText("Arrangement 2 of 5")).toBeTruthy();
    view.rerender(<DemoHarness active />);
    advance();
    expect(view.getByLabelText("Arrangement 3 of 5")).toBeTruthy();
  });

});

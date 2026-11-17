import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { PromptInputSubmit } from "@/components/chat/core-input/submit/submit-button";
import {
  resolveSubmitGlyphState,
  submitGlyphPoint,
} from "@/components/chat/core-input/submit/submit-glyph";

const LAST = 24;

describe("resolveSubmitGlyphState", () => {
  test("ready and idle show the arrow", () => {
    expect(resolveSubmitGlyphState({ status: "ready", canStop: false, stopRequested: false })).toBe(
      "arrow"
    );
    expect(
      resolveSubmitGlyphState({ status: undefined, canStop: false, stopRequested: true })
    ).toBe("arrow");
  });

  test("a running send shows the ring, and the square only when it can be stopped and asked for", () => {
    for (const status of ["submitted", "streaming"] as const) {
      expect(resolveSubmitGlyphState({ status, canStop: true, stopRequested: false })).toBe(
        "working"
      );
      expect(resolveSubmitGlyphState({ status, canStop: true, stopRequested: true })).toBe("stop");
      // Stage and queue mode have no stop: hovering must not promise one.
      expect(resolveSubmitGlyphState({ status, canStop: false, stopRequested: true })).toBe(
        "working"
      );
    }
  });

  test("an error shows the X", () => {
    expect(resolveSubmitGlyphState({ status: "error", canStop: true, stopRequested: true })).toBe(
      "error"
    );
  });
});

describe("submitGlyphPoint", () => {
  const near = (point: readonly [number, number], x: number, y: number) => {
    expect(point[0]).toBeCloseTo(x, 5);
    expect(point[1]).toBeCloseTo(y, 5);
  };

  test("at rest it is the Lucide send arrow", () => {
    // The stem's head (index 0) is the apex end; its tail is the bottom.
    near(submitGlyphPoint("stem", 0, 0, 0, 0), 12, 5);
    near(submitGlyphPoint("stem", LAST, 0, 0, 0), 12, 19);
    near(submitGlyphPoint("left", LAST, 0, 0, 0), 5, 12);
    near(submitGlyphPoint("right", LAST, 0, 0, 0), 19, 12);
  });

  test("lifting raises every stroke by one unit", () => {
    near(submitGlyphPoint("stem", 0, 0, 1, 0), 12, 4);
    near(submitGlyphPoint("left", LAST, 0, 1, 0), 5, 11);
  });

  test("the arms start at the top and stay on the rim in the ring", () => {
    for (const stroke of ["right", "left"] as const) {
      near(submitGlyphPoint(stroke, 0, 1, 1, 0), 12, 4);
      for (let index = 0; index <= LAST; index += 1) {
        const [x, y] = submitGlyphPoint(stroke, index, 1, 1, 0);

        expect(Math.hypot(x - 12, y - 12)).toBeCloseTo(8, 5);
      }
    }
    // The right arm goes clockwise (to the right of the top), the left counterclockwise.
    expect(submitGlyphPoint("right", 4, 1, 1, 0)[0]).toBeGreaterThan(12);
    expect(submitGlyphPoint("left", 4, 1, 1, 0)[0]).toBeLessThan(12);
  });

  test("the stem ends as the long arc: tail at the apex, head 210 degrees round", () => {
    const rad = Math.PI * (210 / 180);

    near(submitGlyphPoint("stem", LAST, 1, 1, 0), 12, 4);
    near(submitGlyphPoint("stem", 0, 1, 1, 0), 12 + 8 * Math.sin(rad), 12 - 8 * Math.cos(rad));
    for (let index = 0; index <= LAST; index += 1) {
      const [x, y] = submitGlyphPoint("stem", index, 1, 1, 0);

      expect(Math.hypot(x - 12, y - 12)).toBeCloseTo(8, 5);
    }
  });

  test("the stem is pulled up and onto the rim, not swept out to it", () => {
    // Halfway, the tail has slid up the line toward the apex: still on x = 12, above the old
    // bottom, and the head has already passed the apex onto the rim.
    const tail = submitGlyphPoint("stem", LAST, 0.5, 1, 0);
    const head = submitGlyphPoint("stem", 0, 0.5, 1, 0);

    expect(tail[0]).toBeCloseTo(12, 5);
    expect(tail[1]).toBeLessThan(18);
    expect(tail[1]).toBeGreaterThan(4);
    expect(Math.hypot(head[0] - 12, head[1] - 12)).toBeCloseTo(8, 5);
    expect(head[0]).toBeGreaterThan(12);

    // No point of the stem ever leaves the line-then-rim track: each is on x = 12 or on the ring.
    for (let index = 0; index <= LAST; index += 1) {
      const [x, y] = submitGlyphPoint("stem", index, 0.5, 1, 0);
      const onLine = Math.abs(x - 12) < 1e-6 && y >= 4 - 1e-6;
      const onRing = Math.abs(Math.hypot(x - 12, y - 12) - 8) < 1e-6;

      expect(onLine || onRing).toBe(true);
    }
  });

  test("the square closes the loop at the top", () => {
    near(submitGlyphPoint("stem", 0, 2, 1, 0), 12, 6);
    near(submitGlyphPoint("stem", LAST, 2, 1, 0), 12, 6);
  });

  test("a full turn of spin lands where it started", () => {
    const rest = submitGlyphPoint("stem", 7, 1, 1, 0);

    near(submitGlyphPoint("stem", 7, 1, 1, 360), rest[0], rest[1]);
  });
});

describe("PromptInputSubmit", () => {
  afterEach(cleanup);

  const glyph = (container: HTMLElement) =>
    container.querySelector("svg")?.getAttribute("data-glyph-state");
  const mouse = { pointerType: "mouse" };

  test("labels follow what a click does", () => {
    const stop = mock(() => {});
    const view = render(<PromptInputSubmit status="streaming" stop={stop} />);

    fireEvent.click(view.getByRole("button", { name: "Abort" }));
    expect(stop).toHaveBeenCalledTimes(1);

    view.rerender(<PromptInputSubmit status="streaming" />);
    expect(view.getByRole("button", { name: "Sending" })).toBeTruthy();

    view.rerender(<PromptInputSubmit status="ready" />);
    expect(view.getByRole("button", { name: "Submit" })).toBeTruthy();
  });

  test("the square shows on mouse hover once the pointer has left and come back", () => {
    const view = render(<PromptInputSubmit status="ready" stop={() => {}} />);
    const button = view.getByRole("button", { name: "Submit" });

    // The click that sends leaves the cursor over the button.
    fireEvent.pointerEnter(button, mouse);
    view.rerender(<PromptInputSubmit status="submitted" stop={() => {}} />);
    expect(glyph(view.container)).toBe("working");

    fireEvent.pointerLeave(button, mouse);
    fireEvent.pointerEnter(button, mouse);
    expect(glyph(view.container)).toBe("stop");

    fireEvent.pointerLeave(button, mouse);
    expect(glyph(view.container)).toBe("working");
  });

  test("a touch never counts as hover, but a held press shows the square", () => {
    const view = render(<PromptInputSubmit status="streaming" stop={() => {}} />);
    const button = view.getByRole("button", { name: "Abort" });

    fireEvent.pointerEnter(button, { pointerType: "touch" });
    expect(glyph(view.container)).toBe("working");

    fireEvent.pointerDown(button, { pointerType: "touch" });
    expect(glyph(view.container)).toBe("stop");

    fireEvent.pointerUp(button, { pointerType: "touch" });
    expect(glyph(view.container)).toBe("working");
  });

  test("with no stop, hovering never promises one", () => {
    const view = render(<PromptInputSubmit status="streaming" />);
    const button = view.getByRole("button", { name: "Sending" });

    fireEvent.pointerEnter(button, mouse);
    expect(glyph(view.container)).toBe("working");
  });
});

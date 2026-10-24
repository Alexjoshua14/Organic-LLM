import { describe, expect, test, afterEach, jest, mock } from "bun:test";
import { cleanup, act } from "@testing-library/react";

import { ProcessingTextBurn } from "@/components/chat/processing-text-burn";
import { render } from "../helpers/render";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe("ProcessingTextBurn", () => {
  test("renders text with per-character spans inside word shells", () => {
    const { container } = render(<ProcessingTextBurn text="Hi there" />);
    const chars = container.querySelectorAll(".processing-text-burn__char");
    const words = container.querySelectorAll(".processing-text-burn__word");

    expect(chars.length).toBe(8); // "Hi" + space + "there"
    expect(words.length).toBe(2);
    expect(container.querySelector(".sr-only")?.textContent).toBe("Hi there");
  });

  test("updates outgoing layer when text changes", () => {
    const { container, rerender } = render(<ProcessingTextBurn text="One" />);

    rerender(<ProcessingTextBurn text="Two" />);

    expect(container.querySelector(".processing-text-burn__char--outgoing")).toBeTruthy();
    expect(container.querySelector(".processing-text-burn__char--incoming")).toBeTruthy();
  });

  test("sustains shimmer after burn-in settles", () => {
    jest.useFakeTimers();
    const { container } = render(<ProcessingTextBurn text="Searching the web..." />);

    expect(container.querySelector(".processing-text-burn__sustain-host")).toBeNull();
    expect(container.querySelectorAll(".processing-text-burn__char").length).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    const sustain = container.querySelector(".processing-text-burn__sustain-host");
    expect(sustain).toBeTruthy();
    expect(sustain?.querySelector(".shiny-text")).toBeTruthy();
    expect(sustain?.textContent).toBe("Searching the web...");
  });

  test("can disable sustain shimmer", () => {
    jest.useFakeTimers();
    const { container } = render(
      <ProcessingTextBurn sustainShimmer={false} text="Searching the web..." />
    );

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(container.querySelector(".processing-text-burn__sustain-host")).toBeNull();
    expect(container.querySelectorAll(".processing-text-burn__char").length).toBeGreaterThan(0);
  });

  test("loop sweep remounts burn chars on the interval while shimmer sustains between", () => {
    jest.useFakeTimers();
    const { container } = render(
      <ProcessingTextBurn loopSweepIntervalS={2} text="Old title" />
    );

    // Initial burn settles (~0.55s), then shimmer until the first 2s loop boundary.
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(container.querySelector(".processing-text-burn__sustain-host")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1_400);
    });
    expect(container.querySelector(".processing-text-burn__sustain-host")).toBeNull();
    expect(
      container.querySelectorAll(".processing-text-burn__char--incoming-initial").length
    ).toBeGreaterThan(0);
  });

  test("defers text change until commit sweep when looping", () => {
    jest.useFakeTimers();
    const onCommit = mock(() => {});
    const { container, rerender } = render(
      <ProcessingTextBurn loopSweepIntervalS={2} text="Old title" />
    );

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    rerender(
      <ProcessingTextBurn
        commitOnNextSweep
        loopSweepIntervalS={2}
        text="New title"
        onCommitSweepSettled={onCommit}
      />
    );

    // Still showing old title until the next 2s boundary.
    expect(container.querySelector(".sr-only")?.textContent).toBe("Old title");
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(container.querySelector(".processing-text-burn__char--outgoing")).toBeTruthy();
    expect(container.querySelector(".sr-only")?.textContent).toBe("New title");

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(onCommit).toHaveBeenCalled();
  });
});

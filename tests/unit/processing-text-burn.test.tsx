import { describe, expect, test, afterEach, jest } from "bun:test";
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

    expect(container.querySelector(".shiny-text")).toBeNull();
    expect(container.querySelectorAll(".processing-text-burn__char").length).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(container.querySelector(".shiny-text")).toBeTruthy();
    expect(container.querySelector(".shiny-text")?.textContent).toBe("Searching the web...");
  });

  test("can disable sustain shimmer", () => {
    jest.useFakeTimers();
    const { container } = render(
      <ProcessingTextBurn sustainShimmer={false} text="Searching the web..." />
    );

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(container.querySelector(".shiny-text")).toBeNull();
    expect(container.querySelectorAll(".processing-text-burn__char").length).toBeGreaterThan(0);
  });
});

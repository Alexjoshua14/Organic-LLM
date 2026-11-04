import { afterEach, describe, expect, jest, test } from "bun:test";
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";

import { ChatReasoningBlock } from "@/components/chat/chat-reasoning-block";
import { useReasoningText } from "@/components/chat/use-reasoning-text";
import { render } from "../helpers/render";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe("reasoning presentation", () => {
  test("keeps an opened disclosure and its text mounted through updates and completion", () => {
    const view = render(<ChatReasoningBlock id="reason" isStreaming text="First point." />);
    const trigger = view.getByRole("button", { name: /Reasoning/ });
    fireEvent.click(trigger);
    const paragraph = view.getByText("First point.");

    view.rerender(
      <ChatReasoningBlock id="reason" isStreaming text="First point. More evidence." />
    );
    view.rerender(
      <ChatReasoningBlock id="reason" isStreaming={false} text="First point. More evidence." />
    );

    expect(view.getByRole("button", { name: "Reasoning" })).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(view.getByText("First point. More evidence.")).toBe(paragraph);
    expect(view.container.querySelector(".processing-text-burn")).toBeNull();
  });

  test("loading and populated reasoning share the same quiet header treatment", () => {
    const view = render(<ChatReasoningBlock id="reason" isStreaming text="" />);
    expect(view.getByRole("status").className).toContain("chat-reasoning__header");
    view.rerender(<ChatReasoningBlock id="reason" isStreaming text="Evidence" />);
    expect(view.getByRole("button", { name: /Reasoning/ }).className).toContain(
      "chat-reasoning__header"
    );
    expect(view.container.firstElementChild?.className).toContain("not-prose");
  });

  test("retains readable Markdown and every paragraph in an independently styled disclosure", () => {
    const text =
      "## A secondary heading\n\nEvidence with **emphasis**.\n\nAnother paragraph and [a source](https://example.com).";
    const view = render(
      <div className="prose">
        <ChatReasoningBlock id="reason" isStreaming={false} text={text} />
      </div>
    );
    fireEvent.click(view.getByRole("button", { name: "Reasoning" }));
    expect(
      view.getByRole("heading", { name: "A secondary heading" }).closest(".chat-reasoning__content")
    ).toBeTruthy();
    expect(view.getByText("emphasis").tagName).toBe("STRONG");
    expect(view.getByRole("link", { name: "a source" }).getAttribute("href")).toBe(
      "https://example.com"
    );
    expect(view.container.textContent).toContain("Another paragraph");
  });
});

describe("reasoning burst reveal", () => {
  test("shows append-only prefixes and catches up even when more deltas arrive", () => {
    jest.useFakeTimers();
    const view = renderHook(({ text }) => useReasoningText(text, true), {
      initialProps: { text: "Start. " },
    });
    const first = "Start. Several pieces of evidence arrive together.";
    view.rerender({ text: first });
    act(() => {
      jest.advanceTimersByTime(24);
    });
    expect(view.result.current.length).toBeGreaterThan("Start. ".length);
    expect(view.result.current.length).toBeLessThan(first.length);
    expect(first.startsWith(view.result.current)).toBe(true);
    const previous = view.result.current;
    const final = first + " This newer delta also stays intact. 😀";
    view.rerender({ text: final });
    act(() => {
      jest.advanceTimersByTime(96);
    });
    expect(view.result.current.startsWith(previous)).toBe(true);
    expect(view.result.current).toBe(final);
  });

  test("completion, hidden content and reduced motion show the exact text immediately", () => {
    jest.useFakeTimers();
    const view = renderHook(({ text, animate }) => useReasoningText(text, animate), {
      initialProps: { text: "", animate: true },
    });
    view.rerender({ text: "Pending tail", animate: true });
    view.rerender({ text: "Completed tail\n\nExact text.", animate: false });
    expect(view.result.current).toBe("Completed tail\n\nExact text.");
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(view.result.current).toBe("Completed tail\n\nExact text.");
  });

  test("a replacement cannot leak the previous message or a stale pending tail", () => {
    jest.useFakeTimers();
    const view = renderHook(({ text }) => useReasoningText(text, true), {
      initialProps: { text: "Old" },
    });
    view.rerender({ text: "Old pending words" });
    view.rerender({ text: "Replacement" });
    expect(view.result.current).toBe("Replacement");
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(view.result.current).toBe("Replacement");
  });
});

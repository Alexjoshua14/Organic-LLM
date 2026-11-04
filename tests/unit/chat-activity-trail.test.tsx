import { afterEach, describe, expect, jest, test } from "bun:test";
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { useState } from "react";

import { ChatActivityTrail, ChatReasoningProse } from "@/components/chat/chat-activity-trail";
import { useReasoningText } from "@/components/chat/use-reasoning-text";
import { render } from "../helpers/render";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

function Trail(props: {
  isLive: boolean;
  text: string;
  summary?: string | null;
  headline?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ChatActivityTrail
      hasContent={Boolean(props.text)}
      headline={props.headline ?? "Thinking…"}
      id="reason"
      isLive={props.isLive}
      open={open}
      summary={props.summary ?? null}
      onOpenChange={setOpen}
    >
      {props.text ? <ChatReasoningProse animate={props.isLive && open} text={props.text} /> : null}
    </ChatActivityTrail>
  );
}

describe("activity trail presentation", () => {
  test("keeps an opened trail and its text mounted from live headline to settled summary", () => {
    const view = render(<Trail isLive headline="Checking sources" text="First point." />);
    const trigger = view.getByRole("button", { name: /Reasoning in progress/ });

    expect(trigger.textContent).toContain("Checking sources");
    fireEvent.click(trigger);
    const paragraph = view.getByText("First point.");

    view.rerender(<Trail isLive headline="Comparing" text="First point. More evidence." />);
    view.rerender(
      <Trail isLive={false} summary="Thought for 14s" text="First point. More evidence." />
    );

    expect(view.getByRole("button", { name: "Thought for 14s" })).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(view.getByText("First point. More evidence.")).toBe(paragraph);
    expect(view.container.querySelector(".processing-text-burn")).toBeNull();
  });

  test("without inspectable content the header is static, and absent when there is nothing to say", () => {
    const view = render(<Trail isLive text="" />);

    expect(view.getByRole("status").className).toContain("chat-reasoning__header");
    view.rerender(<Trail isLive={false} summary="Thought for 3s" text="" />);
    expect(view.queryByRole("button")).toBeNull();
    expect(view.container.textContent).toContain("Thought for 3s");
    view.rerender(<Trail isLive={false} text="" />);
    expect(view.container.firstElementChild).toBeNull();
  });

  test("retains readable Markdown and every paragraph in an independently styled trail", () => {
    const text =
      "## A secondary heading\n\nEvidence with **emphasis**.\n\nAnother paragraph and [a source](https://example.com).";
    const view = render(
      <div className="prose">
        <Trail isLive={false} text={text} />
      </div>
    );

    fireEvent.click(view.getByRole("button", { name: "Reasoning" }));
    expect(
      view.getByRole("heading", { name: "A secondary heading" }).closest(".chat-reasoning__prose")
    ).toBeTruthy();
    expect(view.getByText("emphasis").tagName).toBe("STRONG");
    expect(view.getByRole("link", { name: "a source" }).getAttribute("href")).toBe(
      "https://example.com"
    );
    expect(view.container.textContent).toContain("Another paragraph");
    expect(view.container.querySelector(".chat-reasoning")?.className).toContain("not-prose");
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

import { afterEach, describe, expect, jest, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";

import { SidebarChatTitle } from "@/components/sidebar/sidebar-chat-title";
import {
  publishTitleRegen,
  resetTitleRegenStore,
  startTitleRegen,
} from "@/lib/chat/title-regen-store";
import { render } from "../helpers/render";

afterEach(() => {
  cleanup();
  resetTitleRegenStore();
  jest.useRealTimers();
});

function renderTitle(title = "Old title") {
  return render(
    <SidebarChatTitle editing={false} threadId="thread-1" title={title} onSave={() => {}} />
  );
}

describe("thread title regen states", () => {
  test("stable title is the current string with no shimmer or burn", () => {
    const view = renderTitle();
    const line = view.container.querySelector(".thread-title-line");

    expect(line?.textContent).toBe("Old title");
    expect(line?.className).not.toContain("thread-title-line--shimmer");
    expect(view.container.querySelector(".processing-text-burn__char")).toBeNull();
  });

  test("regenerating adds shimmer on the same text without burning characters", () => {
    const view = renderTitle();

    act(() => {
      startTitleRegen("thread-1", "Old title");
    });

    const line = view.container.querySelector(".thread-title-line");

    expect(line?.textContent).toBe("Old title");
    expect(line?.classList.contains("thread-title-line--shimmer")).toBe(true);
    expect(view.container.querySelector(".processing-text-burn__char")).toBeNull();
  });

  test("a new title burns inside the line, then lands without flashing the old title", () => {
    jest.useFakeTimers();
    const view = renderTitle();

    act(() => {
      startTitleRegen("thread-1", "Old title");
    });
    act(() => {
      publishTitleRegen("thread-1", "Brand new");
    });

    expect(view.container.querySelector(".processing-text-burn__char--outgoing")?.textContent).toBe(
      "O"
    );
    expect(view.container.querySelector(".thread-title-line--shimmer")).toBeNull();
    expect(view.container.querySelector(".sr-only")?.textContent).toBe("Brand new");

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    const line = view.container.querySelector(".thread-title-line");

    expect(view.container.querySelector(".processing-text-burn__char")).toBeNull();
    expect(line?.textContent).toBe("Brand new");
    expect(line?.className).not.toContain("shimmer");
  });

  test("an unchanged title skips the burn and returns to the same string", () => {
    jest.useFakeTimers();
    const view = renderTitle();

    act(() => {
      startTitleRegen("thread-1", "Old title");
      publishTitleRegen("thread-1", "Old title");
    });

    expect(view.container.querySelector(".processing-text-burn__char")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(0);
    });

    const line = view.container.querySelector(".thread-title-line");

    expect(line?.textContent).toBe("Old title");
    expect(line?.classList.contains("thread-title-line--shimmer")).toBe(false);
  });
});

import { afterEach, describe, expect, test } from "bun:test";

import { holdOnboarding } from "@/lib/onboarding/onboarding-blockers";
import { isAnchorPresentable, isBlockingOverlayOpen } from "@/lib/onboarding/presentability";

import { ensureDom } from "../helpers/render";

ensureDom();

const originalElementFromPoint = document.elementFromPoint;

afterEach(() => {
  document.elementFromPoint = originalElementFromPoint;
  document.body.innerHTML = "";
  document.body.removeAttribute("data-scroll-locked");
});

function mount(html: string) {
  document.body.insertAdjacentHTML("beforeend", html);
}

describe("isBlockingOverlayOpen", () => {
  test("nothing open", () => {
    mount('<div role="dialog" data-state="closed"></div>');
    expect(isBlockingOverlayOpen(document)).toBe(false);
  });

  test("open dialogs, sheets and menus block", () => {
    mount('<div role="dialog" data-state="open"></div>');
    expect(isBlockingOverlayOpen(document)).toBe(true);
    document.body.innerHTML = "";

    mount('<div role="menu" data-state="open"></div>');
    expect(isBlockingOverlayOpen(document)).toBe(true);
  });

  test("a scroll lock blocks", () => {
    document.body.setAttribute("data-scroll-locked", "1");
    expect(isBlockingOverlayOpen(document)).toBe(true);
  });

  test("a popper layer blocks unless it is the tip itself or a tooltip", () => {
    mount(
      '<div data-radix-popper-content-wrapper><div role="dialog" data-state="open" data-feature-tip="x"></div></div>'
    );
    expect(isBlockingOverlayOpen(document)).toBe(false);

    mount('<div data-radix-popper-content-wrapper><span role="tooltip">Search</span></div>');
    expect(isBlockingOverlayOpen(document)).toBe(false);

    mount('<div data-radix-popper-content-wrapper><div role="listbox"></div></div>');
    expect(isBlockingOverlayOpen(document)).toBe(true);
  });

  test("another first-visit notice holds onboarding", () => {
    const release = holdOnboarding("notice");

    expect(isBlockingOverlayOpen(document)).toBe(true);
    release();
    expect(isBlockingOverlayOpen(document)).toBe(false);
  });
});

describe("isAnchorPresentable", () => {
  function anchor(rect: Partial<DOMRect>, options: { visible?: boolean; hit?: "self" | "other" } = {}) {
    const element = document.createElement("div");
    const other = document.createElement("div");

    document.body.append(element, other);
    element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, ...rect }) as DOMRect;
    (element as HTMLElement & { checkVisibility: () => boolean }).checkVisibility = () =>
      options.visible ?? true;
    document.elementFromPoint = () => (options.hit === "other" ? other : element);

    return element;
  }

  const onScreen = { left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30 };

  test("a visible, unobstructed anchor qualifies", () => {
    expect(isAnchorPresentable(anchor(onScreen))).toBe(true);
  });

  test("detached, zero-size, mostly off-screen, hidden or covered anchors do not", () => {
    const detached = document.createElement("div");

    expect(isAnchorPresentable(detached)).toBe(false);
    expect(isAnchorPresentable(anchor({ width: 0, height: 0 }))).toBe(false);
    expect(
      isAnchorPresentable(
        anchor({ left: -90, top: 10, right: 10, bottom: 40, width: 100, height: 30 })
      )
    ).toBe(false);
    expect(isAnchorPresentable(anchor(onScreen, { visible: false }))).toBe(false);
    expect(isAnchorPresentable(anchor(onScreen, { hit: "other" }))).toBe(false);
  });
});

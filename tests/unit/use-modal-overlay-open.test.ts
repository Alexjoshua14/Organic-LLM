import { afterEach, describe, expect, test } from "bun:test";

function isModalOverlayOpenFromDom(): boolean {
  if (typeof document === "undefined") return false;

  return Boolean(
    document.querySelector('[data-slot="dialog-overlay"][data-state="open"]') ||
      document.querySelector('[data-slot="dialog-content"][data-state="open"]') ||
      document.querySelector('[data-slot="sheet-content"][data-state="open"]')
  );
}

describe("modal overlay detection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("detects open dialog content and overlay slots", () => {
    document.body.innerHTML = `
      <div data-slot="dialog-overlay" data-state="open"></div>
      <div data-slot="dialog-content" data-state="open" role="dialog">Help</div>
    `;

    expect(isModalOverlayOpenFromDom()).toBe(true);
  });

  test("ignores coachmark popovers that use role=dialog without data-slot", () => {
    document.body.innerHTML = `<div role="dialog" data-state="open">Tip</div>`;

    expect(isModalOverlayOpenFromDom()).toBe(false);
  });

  test("detects open sheets", () => {
    document.body.innerHTML = `<div data-slot="sheet-content" data-state="open"></div>`;

    expect(isModalOverlayOpenFromDom()).toBe(true);
  });
});

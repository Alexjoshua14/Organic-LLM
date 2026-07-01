import { describe, expect, test } from "bun:test";

import {
  NOESIS_SCROLL_RESTORE_BUDGET_MS,
  applyNoesisScrollSnapshot,
  clampScrollTop,
  needsDeferredNoesisScrollRestore,
  reportNoesisScrollRestoreStatus,
} from "@/lib/sandbox/noesis-scroll-restore";

function mockScrollEl(overrides: Partial<HTMLElement> & Pick<HTMLElement, "scrollHeight" | "clientHeight">) {
  return {
    scrollTop: 0,
    scrollHeight: overrides.scrollHeight,
    clientHeight: overrides.clientHeight,
    ...overrides,
  } as HTMLElement;
}

describe("noesis scroll restore", () => {
  test("clampScrollTop respects content bounds", () => {
    const el = mockScrollEl({ scrollHeight: 1000, clientHeight: 400 });

    expect(clampScrollTop(el, 900)).toBe(600);
    expect(clampScrollTop(el, -12)).toBe(0);
  });

  test("applyNoesisScrollSnapshot sets scrollTop synchronously", () => {
    const el = mockScrollEl({ scrollHeight: 1200, clientHeight: 400 });
    let stopped = false;

    applyNoesisScrollSnapshot(
      el,
      { scrollTop: 512, isAtBottom: false, savedAt: Date.now() },
      {
        stopScroll: () => {
          stopped = true;
        },
        scrollToBottom: () => {},
      }
    );

    expect(stopped).toBe(true);
    expect(el.scrollTop).toBe(512);
  });

  test("needsDeferredNoesisScrollRestore when content is shorter than saved offset", () => {
    const el = mockScrollEl({ scrollHeight: 300, clientHeight: 400 });

    expect(
      needsDeferredNoesisScrollRestore(el, {
        scrollTop: 800,
        isAtBottom: false,
        savedAt: Date.now(),
      })
    ).toBe(true);
  });

  test("reportNoesisScrollRestoreStatus warns over budget without failing", () => {
    const warnings: string[] = [];
    const original = console.warn;

    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };

    try {
      reportNoesisScrollRestoreStatus({
        durationMs: NOESIS_SCROLL_RESTORE_BUDGET_MS - 10,
        restored: true,
        deferred: false,
      });
      expect(warnings).toHaveLength(0);

      reportNoesisScrollRestoreStatus({
        durationMs: NOESIS_SCROLL_RESTORE_BUDGET_MS + 25,
        restored: true,
        deferred: true,
      });
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("[noesis-scroll]");
      expect(warnings[0]).toContain(String(NOESIS_SCROLL_RESTORE_BUDGET_MS));
    } finally {
      console.warn = original;
    }
  });
});

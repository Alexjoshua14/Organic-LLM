import type { Vector4 } from "../schemas/physicsSchemas";

import { expect, vi } from "vitest";

/** jsdom returns empty layout unless rects are mocked. */
export function mockBoundingRect(
  element: Element,
  rect: Pick<DOMRect, "x" | "y" | "width" | "height">
): void {
  const full = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    bottom: rect.y + rect.height,
    right: rect.x + rect.width,
    toJSON: () => ({}),
  } as DOMRect;

  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(full);
}

export function assertVector4Near(actual: Vector4, expected: Vector4, floatDigits: number): void {
  expect(actual.x).toBeCloseTo(expected.x, floatDigits);
  expect(actual.y).toBeCloseTo(expected.y, floatDigits);
  expect(actual.w).toBeCloseTo(expected.w, floatDigits);
  expect(actual.h).toBeCloseTo(expected.h, floatDigits);
}

import { afterEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

import { usePageEngaged } from "@/hooks/use-page-engaged";
import { ensureDom } from "../helpers/render";

ensureDom();

describe("usePageEngaged", () => {
  const originalHasFocus = document.hasFocus;

  afterEach(() => {
    document.hasFocus = originalHasFocus;
  });

  test("returns true when disabled regardless of focus", () => {
    document.hasFocus = () => false;
    const { result } = renderHook(() => usePageEngaged(false));

    expect(result.current).toBe(true);
  });

  test("tracks document focus when enabled", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.hasFocus = () => true;

    const { result } = renderHook(() => usePageEngaged(true));

    expect(result.current).toBe(true);

    document.hasFocus = () => false;
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(result.current).toBe(false);
  });
});

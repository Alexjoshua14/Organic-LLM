import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import { ensureDom } from "../helpers/render";

import { evaluateSubmitOnEnter, useSubmitOnEnter } from "@/hooks/use-mobile";

ensureDom();

type MediaQueryListener = (event: MediaQueryListEvent) => void;

function createMatchMedia(matchesByQuery: Record<string, boolean>) {
  const listeners = new Map<string, Set<MediaQueryListener>>();

  return (query: string): MediaQueryList => {
    const listenersForQuery = listeners.get(query) ?? new Set();

    listeners.set(query, listenersForQuery);

    return {
      media: query,
      matches: matchesByQuery[query] ?? false,
      onchange: null,
      addEventListener: (_type: string, listener: MediaQueryListener) => {
        listenersForQuery.add(listener);
      },
      removeEventListener: (_type: string, listener: MediaQueryListener) => {
        listenersForQuery.delete(listener);
      },
      addListener: (listener: MediaQueryListener) => {
        listenersForQuery.add(listener);
      },
      removeListener: (listener: MediaQueryListener) => {
        listenersForQuery.delete(listener);
      },
      dispatchEvent: () => true,
    } as MediaQueryList;
  };
}

describe("evaluateSubmitOnEnter", () => {
  test("phone-like: coarse only → false", () => {
    expect(evaluateSubmitOnEnter(false, false)).toBe(false);
  });

  test("desktop: fine pointer → true", () => {
    expect(evaluateSubmitOnEnter(true, false)).toBe(true);
  });

  test("desktop: hover capability → true", () => {
    expect(evaluateSubmitOnEnter(false, true)).toBe(true);
  });

  test("iPad + keyboard: fine pointer → true", () => {
    expect(evaluateSubmitOnEnter(true, false)).toBe(true);
  });
});

describe("useSubmitOnEnter", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = createMatchMedia({
      "(any-pointer: fine)": false,
      "(any-hover: hover)": false,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  test("resolves false for touch-primary phone", async () => {
    window.matchMedia = createMatchMedia({
      "(any-pointer: fine)": false,
      "(any-hover: hover)": false,
    });

    const { result } = renderHook(() => useSubmitOnEnter());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  test("resolves true for desktop with fine pointer", async () => {
    window.matchMedia = createMatchMedia({
      "(any-pointer: fine)": true,
      "(any-hover: hover)": true,
    });

    const { result } = renderHook(() => useSubmitOnEnter());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  test("updates when media queries change (iPad keyboard attach)", async () => {
    const matchers: Record<string, boolean> = {
      "(any-pointer: fine)": false,
      "(any-hover: hover)": false,
    };
    const listeners = new Map<string, Set<MediaQueryListener>>();

    window.matchMedia = (query: string): MediaQueryList => {
      const set = listeners.get(query) ?? new Set();

      listeners.set(query, set);

      return {
        media: query,
        get matches() {
          return matchers[query] ?? false;
        },
        onchange: null,
        addEventListener: (_type: string, listener: MediaQueryListener) => {
          set.add(listener);
        },
        removeEventListener: (_type: string, listener: MediaQueryListener) => {
          set.delete(listener);
        },
        addListener: (listener: MediaQueryListener) => {
          set.add(listener);
        },
        removeListener: (listener: MediaQueryListener) => {
          set.delete(listener);
        },
        dispatchEvent: () => true,
      } as MediaQueryList;
    };

    const { result } = renderHook(() => useSubmitOnEnter());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    act(() => {
      matchers["(any-pointer: fine)"] = true;
      for (const listener of listeners.get("(any-pointer: fine)") ?? []) {
        listener({ matches: true } as MediaQueryListEvent);
      }
      for (const listener of listeners.get("(any-hover: hover)") ?? []) {
        listener({ matches: false } as MediaQueryListEvent);
      }
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});

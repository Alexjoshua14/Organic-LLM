import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { shouldDeferAudioAutoplayToUserGesture } from "@/lib/tts/defer-audio-autoplay";

describe("shouldDeferAudioAutoplayToUserGesture", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: originalNavigator,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: originalNavigator,
    });
  });

  function setUserAgent(ua: string) {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: { userAgent: ua },
    });
  }

  test("returns true for iPhone user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(shouldDeferAudioAutoplayToUserGesture()).toBe(true);
  });

  test("returns true for iPad user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(shouldDeferAudioAutoplayToUserGesture()).toBe(true);
  });

  test("returns true for iPod user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1"
    );
    expect(shouldDeferAudioAutoplayToUserGesture()).toBe(true);
  });

  test("returns false for typical desktop Linux Chrome", () => {
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    expect(shouldDeferAudioAutoplayToUserGesture()).toBe(false);
  });

  test("returns false for typical Windows desktop Edge", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
    );
    expect(shouldDeferAudioAutoplayToUserGesture()).toBe(false);
  });

  test("Macintosh + ontouchend defers (iPad-as-desktop heuristic)", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    );
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: { ontouchend: null as null },
    });
    try {
      expect(shouldDeferAudioAutoplayToUserGesture()).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        writable: true,
        value: originalDocument,
      });
    }
  });
});

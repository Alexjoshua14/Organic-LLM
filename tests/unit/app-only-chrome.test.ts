import { describe, expect, it } from "bun:test";

import { hidesAppChrome } from "@/components/layout/app-only-chrome";

describe("hidesAppChrome", () => {
  it("hides the sidebar on the blog for signed-out visitors", () => {
    expect(hidesAppChrome("/blog", false)).toBe(true);
    expect(hidesAppChrome("/blog/realtime-voice", false)).toBe(true);
  });

  it("keeps the sidebar on the blog for signed-in readers", () => {
    expect(hidesAppChrome("/blog", true)).toBe(false);
    expect(hidesAppChrome("/blog/realtime-voice", true)).toBe(false);
  });

  it("keeps the sidebar elsewhere, signed in or out", () => {
    expect(hidesAppChrome("/", false)).toBe(false);
    expect(hidesAppChrome("/blogger", false)).toBe(false);
    expect(hidesAppChrome(null, false)).toBe(false);
  });

  it("always hides it on the showcase", () => {
    expect(hidesAppChrome("/showcase", true)).toBe(true);
    expect(hidesAppChrome("/showcase/voice", false)).toBe(true);
  });
});

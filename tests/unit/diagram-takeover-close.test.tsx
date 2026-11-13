import { describe, expect, test } from "bun:test";

/**
 * The shell cannot render under bun's jsdom: @organic-llm/morph-physics resolves its own copy of
 * React, so its hook throws on a second dispatcher. These guard the contract that keeps a phone
 * from getting stuck in an expanded diagram, from the source; the behaviour itself was checked in
 * a browser at 390px (open, Minimize, Close, history restored).
 */
const source = await Bun.file("components/mermaid/diagram-takeover-shell.tsx").text();

describe("expanded diagram: always a way out on a phone", () => {
  test("is portaled to <body>, clear of the app shell's overflow and stacking context", () => {
    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body");
  });

  test("pads the header and the stage for the notch and home bar (viewport-fit=cover)", () => {
    expect(source).toContain("env(safe-area-inset-top)");
    expect(source).toContain("env(safe-area-inset-bottom");
  });

  test("a labelled 44px Close at the top and a Minimize at the thumb, both calling handleClose", () => {
    expect(source).toMatch(/aria-label="Close diagram"[\s\S]*?h-11/);
    expect(source).toContain("Minimize");
    expect(source.match(/onClick=\{handleClose\}/g)?.length).toBe(2);
  });

  test("the stage leaves room above the Minimize pill", () => {
    expect(
      source.match(/max-sm:bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom/g)?.length
    ).toBe(2);
  });
});

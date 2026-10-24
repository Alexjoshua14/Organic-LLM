import { describe, expect, test } from "bun:test";

import {
  fullViewComposerCollapseSpring,
  fullViewComposerExpandSpring,
  fullViewComposerSpringForDock,
} from "@/lib/homepage/full-view-composer-springs";

describe("fullViewComposerSpringForDock", () => {
  test("uses expand spring when engaged", () => {
    expect(fullViewComposerSpringForDock("engaged")).toBe(fullViewComposerExpandSpring);
  });

  test("uses faster collapse spring when docked", () => {
    const collapse = fullViewComposerSpringForDock("docked");

    expect(collapse).toBe(fullViewComposerCollapseSpring);
    expect(collapse.stiffness).toBeGreaterThan(fullViewComposerExpandSpring.stiffness);
    expect(collapse.mass).toBeLessThan(fullViewComposerExpandSpring.mass);
  });
});

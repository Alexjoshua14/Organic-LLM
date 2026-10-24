import { afterEach, describe, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import {
  activityGlassForState,
  getActivityMarkGlassProfile,
} from "@/components/chat/activity-mark-glass";
import { OrganicActivityMark } from "@/components/chat/organic-activity-mark";
import { SubagentIdentityMark } from "@/components/agents/subagent-identity-mark";
import { render } from "../helpers/render";

afterEach(cleanup);

describe("SubagentIdentityMark & OrganicActivityMark intensity modulation", () => {
  test("preserves exact baseline markup and glass styles when intensity is omitted", () => {
    const htmlA = renderToString(<OrganicActivityMark renderer="v0" seed="Lyra" state="working" />);
    const htmlB = renderToString(<OrganicActivityMark renderer="v0" seed="Lyra" state="working" />);

    expect(htmlA).toBe(htmlB);
    expect(htmlA).not.toContain("data-intensity=");

    const view = render(<SubagentIdentityMark name="Lyra" state="working" />);
    const mark = view.getByRole("img", { name: "Lyra identity mark" });
    const backdrop = mark.querySelector<HTMLElement>('[data-activity-layer="backdrop"]')!;

    expect(backdrop.style.filter).toBe("blur(0.5px) brightness(1.08) saturate(1.12)");
  });

  test("modulates backdrop glass filter and exposes data-intensity attributes when intensity is provided", () => {
    const view = render(
      <OrganicActivityMark
        intensity={0.85}
        label="Intense agent mark"
        renderer="v0"
        seed="Reed"
        state="working"
      />
    );

    const mark = view.getByRole("img", { name: "Intense agent mark" });
    expect(mark.getAttribute("data-intensity")).toBe("0.85");
    expect(mark.getAttribute("data-intensity-tier")).toBe("intense");

    const profile = getActivityMarkGlassProfile("working", 0.85);
    const backdrop = mark.querySelector<HTMLElement>('[data-activity-layer="backdrop"]')!;

    expect(backdrop.style.filter).toBe(
      `blur(${profile.blur}px) brightness(${profile.brightness}) saturate(${profile.saturation})`
    );
    expect(profile.brightness).toBeGreaterThan(activityGlassForState("working").brightness);
  });

  test("honors prefers-reduced-motion with static dot poses while preserving glass intensity", () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });

    try {
      const view = render(
        <OrganicActivityMark
          intensity={0.75}
          label="Reduced motion mark"
          renderer="auto"
          seed="Archer"
          state="working"
        />
      );
      const mark = view.getByRole("img", { name: "Reduced motion mark" });
      expect(mark.getAttribute("data-intensity")).toBe("0.75");
      expect(mark.querySelector('[data-dot-renderer="v0"]')).toBeTruthy();
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, "matchMedia", originalMatchMedia);
      } else {
        Reflect.deleteProperty(window, "matchMedia");
      }
    }
  });
});

import { describe, expect, test } from "bun:test";

import {
  type FooterSurface,
  hasOverflowItems,
  resolveFooterPlacement,
} from "@/components/chat/core-input/footer/footer-placement";

/** Main chat at desktop width with every optional control available. */
const FULL: FooterSurface = {
  condensed: false,
  compact: false,
  personaEnabled: true,
  hideWebMemorySpeechToggles: false,
  hasSpeechFriendly: true,
  hasMarkdownPreview: true,
  previewingMarkdown: false,
  hasSteer: true,
  showContextEffort: true,
};

describe("CoreInput footer placement", () => {
  test("a wide composer puts every available control on the toolbar", () => {
    expect(resolveFooterPlacement(FULL)).toEqual({
      persona: "inline",
      toolToggles: "inline",
      speech: "inline",
      preview: "inline",
      modelEffort: "inline",
      contextEffort: "inline",
      addFiles: "inline",
      threadClipboard: "inline",
      mic: "inline",
      steer: "inline",
    });
    expect(hasOverflowItems(resolveFooterPlacement(FULL))).toBe(false);
  });

  test("a narrow composer moves speech, preview, and steer into the overflow menu", () => {
    const placement = resolveFooterPlacement({ ...FULL, condensed: true });

    expect(placement).toEqual({
      persona: "inline",
      toolToggles: "inline",
      speech: "menu",
      preview: "menu",
      modelEffort: "inline",
      contextEffort: "inline",
      addFiles: "inline",
      threadClipboard: "inline",
      mic: "inline",
      steer: "menu",
    });
    expect(hasOverflowItems(placement)).toBe(true);
  });

  test("the compact variant drops search and memory entirely", () => {
    const placement = resolveFooterPlacement({ ...FULL, condensed: true, compact: true });

    expect(placement.toolToggles).toBe("hidden");
    expect(placement.speech).toBe("menu");
  });

  test("controls the surface did not opt into are hidden", () => {
    const placement = resolveFooterPlacement({
      ...FULL,
      personaEnabled: false,
      hasSpeechFriendly: false,
      hasMarkdownPreview: false,
      hasSteer: false,
      showContextEffort: false,
    });

    expect(placement.persona).toBe("hidden");
    expect(placement.speech).toBe("hidden");
    expect(placement.preview).toBe("hidden");
    expect(placement.steer).toBe("hidden");
    expect(placement.contextEffort).toBe("hidden");
    expect(placement.modelEffort).toBe("inline");
    expect(
      hasOverflowItems(
        resolveFooterPlacement({
          ...FULL,
          condensed: true,
          hasSpeechFriendly: false,
          hasMarkdownPreview: false,
          hasSteer: false,
        })
      )
    ).toBe(false);
  });

  test("hideWebMemorySpeechToggles hides inline speech but not the menu item", () => {
    const hidden = { ...FULL, hideWebMemorySpeechToggles: true };

    expect(resolveFooterPlacement(hidden).toolToggles).toBe("hidden");
    expect(resolveFooterPlacement(hidden).speech).toBe("hidden");
    expect(resolveFooterPlacement({ ...hidden, condensed: true }).speech).toBe("menu");
  });

  test("the mic hides while the markdown preview replaces the textarea", () => {
    expect(resolveFooterPlacement({ ...FULL, previewingMarkdown: true }).mic).toBe("hidden");
    expect(
      resolveFooterPlacement({ ...FULL, hasMarkdownPreview: false, previewingMarkdown: true }).mic
    ).toBe("inline");
  });
});

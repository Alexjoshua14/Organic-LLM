import { describe, expect, test } from "bun:test";

import { CHAT_STYLES } from "@/lib/chat/chat-style";
import {
  ARCADIA_CHAT_STYLE_HINT_IDS,
  ARCADIA_CHAT_STYLE_HINT_ID_LIST,
} from "@/lib/onboarding/arcadia-chat-style-hints";
import { FEATURE_HINT_IDS, getFeatureHint } from "@/lib/onboarding/feature-hints";
import { compareFeatureHintPriority } from "@/lib/onboarding/feature-hint-priority";

describe("arcadia chat style hints", () => {
  test("maps each style to a feature hint with guide copy", () => {
    for (const style of CHAT_STYLES) {
      const hintId = ARCADIA_CHAT_STYLE_HINT_IDS[style.id];

      expect(FEATURE_HINT_IDS).toContain(hintId);
      expect(getFeatureHint(hintId).title).toBe(style.label);
      expect(style.guide.length).toBeGreaterThan(20);
    }

    expect(ARCADIA_CHAT_STYLE_HINT_ID_LIST).toHaveLength(CHAT_STYLES.length);
  });

  test("style hints follow the Arcadia overview hint", () => {
    for (const styleHint of ARCADIA_CHAT_STYLE_HINT_ID_LIST) {
      expect(compareFeatureHintPriority("arcadia-starters", styleHint)).toBeLessThan(0);
    }
  });

  test("arcadia-starters overview mentions every chat style", () => {
    const overview = getFeatureHint("arcadia-starters");

    for (const style of CHAT_STYLES) {
      expect(overview.body).toContain(style.label);
    }
  });

  test("style hints share one spotlight shape on the Arcadia route", () => {
    for (const hintId of ARCADIA_CHAT_STYLE_HINT_ID_LIST) {
      const hint = getFeatureHint(hintId);

      expect(hint.enabled).toBe(true);
      expect(hint.presentation).toBe("spotlight");
      expect(hint.side).toBe("bottom");
      expect(hint.align).toBe("center");
      expect(hint.pathPrefix).toBe("/sandbox/arcadia");
      expect(hint.deferUntilNavigationSettled).toBe(true);
      expect(hint.contextualBackdrop).toBe("blur");
    }
  });

  test("Jev hint explains the read-first flow and the acknowledgement override", () => {
    expect(ARCADIA_CHAT_STYLE_HINT_IDS.jev).toBe("arcadia-style-jev");

    const hint = getFeatureHint("arcadia-style-jev");

    expect(hint.title).toBe("Jev");
    expect(hint.body).toContain("reads each message first");
    expect(hint.body).toContain("voice");
    expect(hint.body).toContain("Acknowledged");
    expect(hint.body).toContain("Respond anyway");
  });
});

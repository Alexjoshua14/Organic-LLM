import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { render } from "../helpers/render";

import {
  AutoModelLumenPill,
  computeAutoPillTargetGeometry,
} from "@/components/chat/auto-model-lumen-pill";
import { ComposerModelSelect } from "@/components/chat/core-input/controls/model-select";
import {
  CoreInputControlsProvider,
  type CoreInputControlsValue,
} from "@/components/chat/core-input/core-input-context";
import { previewAutoModelClientSync } from "@/hooks/use-auto-model-preview";
import { AUTO_CHAT_MODEL, ChatModels, models } from "@/lib/schemas/chat";

beforeEach(() => {
  if (typeof globalThis.DocumentFragment === "undefined" && typeof window !== "undefined") {
    globalThis.DocumentFragment = window.DocumentFragment;
  }
});

afterEach(() => {
  cleanup();
});

function makeControlsValue(
  overrides: Partial<CoreInputControlsValue> = {}
): CoreInputControlsValue {
  const decision = previewAutoModelClientSync({
    text: "Implement a 2D signed-distance field raycaster in Rust and TypeScript",
    activityState: "typing",
  });

  return {
    showLabels: true,
    useCondensedLayout: false,
    useWebSearch: true,
    setUseWebSearch: () => {},
    useMemories: true,
    setUseMemories: () => {},
    useSpeechFriendly: false,
    setUseSpeechFriendly: () => {},
    inputMarkdownMode: "edit",
    setInputMarkdownMode: () => {},
    model: AUTO_CHAT_MODEL,
    selectableModels: ChatModels,
    onModelChange: () => {},
    effort: "auto",
    onEffortChange: () => {},
    showContextEffort: false,
    contextEffort: "medium",
    onContextEffortChange: () => {},
    autoModelPreview: {
      isAuto: true,
      activityState: "typing",
      decision,
      notifyKeystroke: () => {},
      notifySelectionOrCursorMove: () => {},
    },
    ...overrides,
  };
}

describe("AutoModelLumenPill", () => {
  test("renders the routed model name in place of literal 'Auto' while keeping data-model-id='auto'", () => {
    const { container } = render(
      <AutoModelLumenPill
        activityState="typing"
        domain="coding"
        reason="Selected for TypeScript implementation"
        routedModelFullTitle="Claude Sonnet 5.5"
        routedModelId={models.anthropic.sonnet.id}
        routedModelLabel="Sonnet 5.5"
      />
    );

    const pill = container.querySelector<HTMLElement>(".auto-model-lumen-pill");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("data-model-id")).toBe("auto");
    expect(pill?.getAttribute("data-selector-id")).toBe("auto");
    expect(pill?.getAttribute("data-routed-model-id")).toBe(models.anthropic.sonnet.id);
    expect(pill?.getAttribute("data-activity-state")).toBe("typing");

    const titleEl = container.querySelector<HTMLElement>("[data-auto-routed-title]");
    expect(titleEl?.getAttribute("data-auto-routed-title")).toBe("Sonnet 5.5");
    expect(titleEl?.textContent).toBe("Sonnet 5.5");
  });

  test("renders per-character raycast lumen spans with textShadow and backdrop caustic CSS vars", () => {
    const { container } = render(
      <AutoModelLumenPill
        activityState="thinking"
        routedModelFullTitle="Claude Opus 5.5"
        routedModelId={models.anthropic.opus.id}
        routedModelLabel="Opus 5.5"
      />
    );

    const pill = container.querySelector<HTMLElement>(".auto-model-lumen-pill")!;
    expect(pill.style.getPropertyValue("--lumen-backdrop-caustic")).toContain("radial-gradient");
    expect(pill.style.getPropertyValue("--lumen-border-sheen")).toContain("linear-gradient");
    expect(pill.style.backgroundImage).toContain("rgba(6, 8, 10, 0.72)");
    expect(pill.style.backgroundImage).toContain("rgba(6, 8, 10, 0.18)");
    expect(pill.className).toContain("border-white/[0.07]");

    const charSpans = container.querySelectorAll<HTMLElement>("[data-lumen-char-index]");
    expect(charSpans.length).toBe("Opus 5.5".length);
    expect(charSpans[0]?.style.textShadow).toContain("--lumen-rim");
  });

  test("computes MorphPhysics target geometry that expands and contracts with model title length and includes padding buffer for measured widths", () => {
    const shortGeom = computeAutoPillTargetGeometry("Haiku 5.5", { activityState: "idle" });
    const longGeom = computeAutoPillTargetGeometry("Gemini 3.1 Pro", { activityState: "typing" });

    expect(longGeom.w).toBeGreaterThan(shortGeom.w);
    expect(longGeom.w).toBeGreaterThanOrEqual(140);
    expect(shortGeom.h).toBe(22);

    const measuredRegular = computeAutoPillTargetGeometry("Gemini 3.1 Pro", {
      activityState: "idle",
      measuredWidthPx: 102,
      measuredHeightPx: 16,
    });
    expect(measuredRegular.w).toBe(102 + 22);
    expect(measuredRegular.h).toBe(22);

    const measuredCondensed = computeAutoPillTargetGeometry("Gemini 3.1 Pro", {
      condensed: true,
      activityState: "idle",
      measuredWidthPx: 102,
    });
    expect(measuredCondensed.w).toBe(102 + 18);

    const { container, rerender } = render(
      <AutoModelLumenPill
        reduceMotion
        activityState="idle"
        routedModelFullTitle="Claude Haiku 5.5"
        routedModelId={models.anthropic.haiku.id}
        routedModelLabel="Haiku 5.5"
      />
    );

    const pill = container.querySelector<HTMLElement>(".auto-model-lumen-pill")!;
    expect(pill.getAttribute("data-reduced-motion")).toBe("true");
    const initialW = Number(pill.getAttribute("data-target-width"));

    rerender(
      <AutoModelLumenPill
        reduceMotion
        activityState="thinking"
        routedModelFullTitle="Gemini 3.1 Pro"
        routedModelId={models.google.pro.id}
        routedModelLabel="Gemini 3.1 Pro"
      />
    );

    const expandedW = Number(pill.getAttribute("data-target-width"));
    expect(expandedW).toBeGreaterThan(initialW);
  });

  test("ComposerModelSelect renders AutoModelLumenPill when Auto is selected", () => {
    const { container } = render(
      <CoreInputControlsProvider value={makeControlsValue()}>
        <ComposerModelSelect />
      </CoreInputControlsProvider>
    );

    const trigger = screen.getByRole("combobox", { name: "Model" });
    expect(trigger.getAttribute("data-model-id")).toBe("auto");
    expect(trigger.className).toContain("max-w-56");

    const pill = container.querySelector<HTMLElement>(".auto-model-lumen-pill");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("data-model-id")).toBe("auto");
    expect(pill?.textContent).toContain("Opus 5.5");
  });
});

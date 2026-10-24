import { describe, expect, test } from "bun:test";

import {
  AUTO_MODEL_IDLE_TIMEOUT_MS,
  AUTO_MODEL_THINKING_PAUSE_MS,
  previewAutoModelClientSync,
  resolveComposerActivityState,
} from "@/hooks/use-auto-model-preview";
import {
  REASONING_IDS_ANY,
  REASONING_IDS_ZDR,
  REFLEX_IDS_ZDR,
  chatModelForGatewayId,
  classifyTaskTier,
  evaluateAutoModelChangeGate,
  formatCompactModelLabel,
  routeAutoModel,
  selectAutoRouteModel,
  tierToGatewayModelId,
} from "@/lib/llm/auto-model-router";
import { JEV_GATEWAY_MODEL_ID } from "@/lib/llm/subagents/orchestrator/router-zdr";
import {
  AUTO_CHAT_MODEL_ID,
  ChatModelCatalog,
  DEFAULT_CHAT_MODEL,
  models,
  type GatewayModelId,
} from "@/lib/schemas/chat";

describe("classifyTaskTier", () => {
  test("short plain text is reflex", () => {
    expect(classifyTaskTier("remember I like oat milk")).toBe("reflex");
  });

  test("keyword why routes to reasoning", () => {
    expect(classifyTaskTier("Why is the sky blue?")).toBe("reasoning");
  });

  test("long text routes to reasoning", () => {
    const s = "x".repeat(300);
    expect(classifyTaskTier(s)).toBe("reasoning");
  });
});

describe("chatModelForGatewayId", () => {
  test("returns catalog row for a models alias id", () => {
    const m = chatModelForGatewayId(models.openai.luna.id as GatewayModelId);
    expect(m.id).toBe(models.openai.luna.id);
  });

  test("unknown ids fall back to DEFAULT_CHAT_MODEL", () => {
    const m = chatModelForGatewayId("openai/gpt-5.4-nano" as GatewayModelId);
    expect(m).toEqual(DEFAULT_CHAT_MODEL);
  });
});

describe("tierToGatewayModelId", () => {
  test("preference lists only contain catalog ids", () => {
    const catalog = new Set(ChatModelCatalog.map((c) => c.id));

    for (const id of [...REFLEX_IDS_ZDR, ...REASONING_IDS_ZDR, ...REASONING_IDS_ANY]) {
      expect(catalog.has(id)).toBe(true);
    }
  });

  test("ZDR reflex prefers Gemini Flash Lite via models", () => {
    expect(tierToGatewayModelId("reflex", true)).toBe(models.google.flashLite.id);
  });

  test("ZDR reflex picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reflex", true);
    const row = ChatModelCatalog.find((c) => c.id === id)!;
    expect(row.id).not.toBe(AUTO_CHAT_MODEL_ID);
    expect(row.supportsZeroDataRetention).not.toBe(false);
  });

  test("ZDR reasoning picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reasoning", true);
    const row = ChatModelCatalog.find((c) => c.id === id)!;
    expect(row.id).not.toBe(AUTO_CHAT_MODEL_ID);
    expect(row.supportsZeroDataRetention).not.toBe(false);
  });

  test("non-ZDR reasoning may use non-ZDR catalog entries", () => {
    const id = tierToGatewayModelId("reasoning", false);
    expect(ChatModelCatalog.some((c) => c.id === id)).toBe(true);
  });
});

describe("Stage 1 — evaluateAutoModelChangeGate (material change + Jev ZDR gate)", () => {
  test("skips rerouting on empty or sub-threshold single-character noise", async () => {
    const emptyGate = await evaluateAutoModelChangeGate({
      text: "   ",
      previousText: "",
      activityState: "idle",
    });
    expect(emptyGate.shouldReroute).toBe(false);
    expect(emptyGate.zdr).toBe(true);
    expect(emptyGate.jevCallConfig.model).toBe(JEV_GATEWAY_MODEL_ID);
    expect(emptyGate.jevCallConfig.providerOptions.gateway.zeroDataRetention).toBe(true);

    const tinyNoise = await evaluateAutoModelChangeGate({
      text: "hello there!",
      previousText: "hello there",
      previousDomain: "trivial",
      activityState: "typing",
      previousActivityState: "typing",
    });
    expect(tinyNoise.shouldReroute).toBe(false);
  });

  test("detects structural shifts (code fence, math proof, domain flip, activity transition)", async () => {
    const codeShift = await evaluateAutoModelChangeGate({
      text: "Can you fix this TypeScript hook?\n```ts\nconst x = useEffect(() => {}, []);\n```",
      previousText: "hey",
      activityState: "typing",
    });
    expect(codeShift.shouldReroute).toBe(true);
    expect(codeShift.domainShift).toBe("coding");
    expect(codeShift.localDelta.structuralShift).toBe(true);

    const pauseTransition = await evaluateAutoModelChangeGate({
      text: "Design a distributed event-driven postgres architecture with low latency",
      previousText: "Design a distributed event-driven postgres architecture with low latency",
      activityState: "thinking",
      previousActivityState: "typing",
    });
    expect(pauseTransition.shouldReroute).toBe(true);
    expect(pauseTransition.localDelta.activityTransition).toBe(true);
    expect(pauseTransition.domainShift).toBe("architecture");
  });

  test("passes mandatory Jev ZDR providerOptions when invoking injected Stage 1 generator", async () => {
    let capturedModel = "";
    let capturedZdr = false;

    const gate = await evaluateAutoModelChangeGate(
      {
        text: "Prove that every symmetric real matrix has real eigenvalues using the spectral theorem.",
        previousText: "hi",
        activityState: "thinking",
      },
      {
        generateGate: async (args) => {
          capturedModel = args.model;
          capturedZdr = args.providerOptions.gateway.zeroDataRetention;
          return {
            object: {
              shouldReroute: true,
              domainShift: "math_science",
              confidence: 0.97,
            },
          };
        },
      }
    );

    expect(capturedModel).toBe(JEV_GATEWAY_MODEL_ID);
    expect(capturedZdr).toBe(true);
    expect(gate.usedJevLive).toBe(true);
    expect(gate.shouldReroute).toBe(true);
    expect(gate.domainShift).toBe("math_science");
  });
});

describe("Stage 2 — selectAutoRouteModel & full routeAutoModel pipeline", () => {
  test("routes coding, math/science, research, architecture, and quick turns while preserving selectedSelectorId: 'auto'", async () => {
    const quick = await routeAutoModel({
      text: "Hey there, how's it going?",
      activityState: "typing",
    });
    expect(quick.selectedSelectorId).toBe("auto");
    expect(quick.zdr).toBe(true);
    expect(quick.domain).toBe("trivial");
    expect(quick.routedModelId).toBe(models.anthropic.haiku.id);
    expect(quick.routedModelLabel).toBe(formatCompactModelLabel(models.anthropic.haiku.name));

    const coding = await routeAutoModel({
      text: "Refactor this Next.js React component and fix the TypeScript generics:\n```tsx\nexport function Foo<T>(props: T) {}\n```",
      activityState: "typing",
    });
    expect(coding.selectedSelectorId).toBe("auto");
    expect(coding.domain).toBe("coding");
    expect(coding.routedModelId).toBe(models.anthropic.sonnet.id);
    expect(coding.routedModelLabel).toContain("Sonnet");

    const math = await routeAutoModel({
      text: "Prove the Cauchy-Schwarz inequality and derive the Euler-Lagrange differential equation for a harmonic oscillator.",
      activityState: "thinking",
    });
    expect(math.selectedSelectorId).toBe("auto");
    expect(math.domain).toBe("math_science");
    expect(math.routedModelId).toBe(models.anthropic.opus.id);
    expect(math.routedModelLabel).toContain("Opus");

    const research = await routeAutoModel({
      text: "Conduct a comprehensive literature review and compare and contrast peer-reviewed sources on solid-state battery electrolytes.",
      activityState: "reviewing",
      webSearch: true,
    });
    expect(research.selectedSelectorId).toBe("auto");
    expect(research.domain).toBe("research");
    expect(research.routedModelId).toBe(models.google.pro.id);
    expect(research.routedModelFullTitle).toBe(models.google.pro.name);
  });

  test("handles disconnected and idle activity states gracefully", async () => {
    const disconnectedHeld = await selectAutoRouteModel({
      text: "Still editing offline",
      previousModelId: models.anthropic.opus.id,
      activityState: "disconnected",
    });
    expect(disconnectedHeld.selectedSelectorId).toBe("auto");
    expect(disconnectedHeld.activityState).toBe("disconnected");
    expect(disconnectedHeld.routedModelId).toBe(models.anthropic.opus.id);
    expect(disconnectedHeld.changedMaterially).toBe(false);

    const idleEmpty = previewAutoModelClientSync({
      text: "",
      activityState: "idle",
    });
    expect(idleEmpty.selectedSelectorId).toBe("auto");
    expect(idleEmpty.activityState).toBe("idle");
    expect(idleEmpty.routedModelId).toBe(models.anthropic.sonnet.id);
  });

  test("resolveComposerActivityState transitions across typing, thinking, reviewing, idle, and disconnected", () => {
    expect(
      resolveComposerActivityState({
        isOnline: false,
        hasText: true,
        msSinceLastKeystroke: 100,
        msSinceLastSelectionMove: null,
        msSinceLastInteraction: 100,
      })
    ).toBe("disconnected");

    expect(
      resolveComposerActivityState({
        isOnline: true,
        hasText: true,
        msSinceLastKeystroke: 200,
        msSinceLastSelectionMove: null,
        msSinceLastInteraction: 200,
      })
    ).toBe("typing");

    expect(
      resolveComposerActivityState({
        isOnline: true,
        hasText: true,
        msSinceLastKeystroke: AUTO_MODEL_THINKING_PAUSE_MS + 200,
        msSinceLastSelectionMove: null,
        msSinceLastInteraction: AUTO_MODEL_THINKING_PAUSE_MS + 200,
      })
    ).toBe("thinking");

    expect(
      resolveComposerActivityState({
        isOnline: true,
        hasText: true,
        msSinceLastKeystroke: AUTO_MODEL_THINKING_PAUSE_MS + 500,
        msSinceLastSelectionMove: 120,
        msSinceLastInteraction: 120,
      })
    ).toBe("reviewing");

    expect(
      resolveComposerActivityState({
        isOnline: true,
        hasText: true,
        msSinceLastKeystroke: AUTO_MODEL_IDLE_TIMEOUT_MS + 100,
        msSinceLastSelectionMove: null,
        msSinceLastInteraction: AUTO_MODEL_IDLE_TIMEOUT_MS + 100,
      })
    ).toBe("idle");
  });
});

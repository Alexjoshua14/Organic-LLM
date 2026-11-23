import { describe, expect, test } from "bun:test";

import {
  estimateOutputCostUsd,
  RespondOutputBudgetExceededError,
} from "@/lib/jev-stage/budget";
import { JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD } from "@/lib/jev-stage/constants";
import { executeJevDirectTool } from "@/lib/jev-stage/direct-tools";
import {
  directToolNeedsPhrase,
  leanPhraseContext,
} from "@/lib/jev-stage/phrase";
import {
  invalidSelectedActionReason,
  settingsBlockReason,
} from "@/lib/jev-stage/validate-action";
import {
  applyJevRespondEffects,
  createJevRespondTools,
  emptyJevRespondEffects,
} from "@/lib/jev-stage/respond";
import { createStageTurnTools, modelForTier } from "@/lib/stage/agent";
import { emptyStageState, type StageTurnSettings } from "@/lib/stage/schema";

describe("jev-stage direct tools", () => {
  test("view_switch rejects an invalid view without mutating widgets", async () => {
    const state = emptyStageState();
    const result = await executeJevDirectTool({
      ownerId: "00000000-0000-0000-0000-000000000001",
      state,
      selected: {
        kind: "view_switch",
        confidence: 0.9,
        reason: "bad view",
        args: { view: { kind: "nope" } },
      },
      message: "show overview",
      requestId: "00000000-0000-4000-8000-000000000002",
    });

    expect(result.note).toMatch(/invalid/i);
    expect(result.needsPhrase).toBe(false);
    expect(result.state.widgets).toEqual(state.widgets);
    expect(result.state.revision).toBe(state.revision);
  });

  test("recall patches Stage and requests a phrase hop without a status reply", async () => {
    const state = emptyStageState();
    const requestId = "00000000-0000-4000-8000-000000000010";
    const result = await executeJevDirectTool({
      ownerId: "00000000-0000-0000-0000-000000000001",
      state,
      selected: {
        kind: "recall",
        confidence: 0.9,
        reason: "what do you know",
        args: { query: "What do you know about me?" },
      },
      message: "What do you know about me?",
      requestId,
    });

    expect(result.needsPhrase).toBe(true);
    expect(result.phraseContext).toContain("recall");
    expect(result.phraseContext).toContain("What do you know about me?");
    expect(result.note).toBeNull();
    expect(result.state.messages).toEqual(state.messages);
    expect(result.state.revision).toBe(state.revision + 1);
    expect(result.state.widgets.some((widget) => widget.kind === "recall")).toBe(true);
  });

  test("phrase helper marks only lookup directs", () => {
    expect(directToolNeedsPhrase("recall")).toBe(true);
    expect(directToolNeedsPhrase("memory_search")).toBe(true);
    expect(directToolNeedsPhrase("web_search")).toBe(true);
    expect(directToolNeedsPhrase("clear_pieces")).toBe(false);
    expect(directToolNeedsPhrase("respond")).toBe(false);
    expect(leanPhraseContext("recall", { query: "me", items: ["a".repeat(4000)] }).length).toBeLessThanOrEqual(
      1600
    );
  });
});

describe("jev-stage respond budget errors", () => {
  test("RespondOutputBudgetExceededError names the $0.10 cap", () => {
    const tokens = 50_000;
    const cost = estimateOutputCostUsd("openai/gpt-6.2-sol", tokens);
    const error = new RespondOutputBudgetExceededError(
      "openai/gpt-6.2-sol",
      tokens,
      cost,
      JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD
    );

    expect(error.message).toContain("$0.10");
    expect(error.budgetUsd).toBe(0.1);
    expect(cost).toBeGreaterThan(JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD);
  });
});

describe("jev-stage respond toolset", () => {
  const ownerId = "00000000-0000-0000-0000-000000000001";
  const respondToolNames = (settings?: StageTurnSettings) =>
    Object.keys(
      createJevRespondTools({
        ownerId,
        state: emptyStageState(),
        settings,
        effects: emptyJevRespondEffects(),
      })
    );

  test("includes memory search by default, even when settings omit memory", () => {
    expect(respondToolNames(undefined)).toContain("search_memories");
    expect(respondToolNames({})).toContain("search_memories");
    expect(respondToolNames({ memory: false })).not.toContain("search_memories");
  });

  test("phrase hop can omit lookup tools already satisfied by a direct digest", () => {
    const names = Object.keys(
      createJevRespondTools({
        ownerId,
        state: emptyStageState(),
        effects: emptyJevRespondEffects(),
        omitLookupTools: ["search_memories", "recall_memories"],
      })
    );

    expect(names).not.toContain("search_memories");
    expect(names).not.toContain("recall_memories");
    expect(names).toContain("web_search");
  });

  test("is a superset of Stage's central-model toolset for every settings shape", () => {
    const shapes: (StageTurnSettings | undefined)[] = [
      undefined,
      {},
      { memory: true },
      { webSearch: true },
      { memory: true, webSearch: true },
    ];

    for (const settings of shapes) {
      const names = respondToolNames(settings);

      for (const stageTool of Object.keys(createStageTurnTools(ownerId, settings))) {
        expect(names).toContain(stageTool);
      }
    }
    expect(respondToolNames({ webSearch: true })).toContain("web_search");
  });

  test("includes web search by default, unless settings turn it off", () => {
    expect(respondToolNames(undefined)).toContain("web_search");
    expect(respondToolNames({})).toContain("web_search");
    expect(respondToolNames({ webSearch: false })).not.toContain("web_search");
  });

  test("covers Stage's structured turn effects as tools", () => {
    expect(respondToolNames({})).toEqual(
      expect.arrayContaining([
        "update_summary",
        "set_design_brief",
        "switch_view",
        "file_captures",
        "recall_memories",
        "dispatch_specialists",
        "set_next_tier",
      ])
    );
  });

  test("applies collected effects to the prototype state", () => {
    const effects = emptyJevRespondEffects();

    effects.captures.push({ collectionId: null, collection: "Ideas", text: "Try Jev routing" });
    effects.nextTier = "deep";
    const state = emptyStageState();
    const applied = applyJevRespondEffects({
      state,
      effects,
      requestId: "00000000-0000-4000-8000-000000000003",
    });

    expect(applied.state.revision).toBe(state.revision + 1);
    expect(applied.state.nextModel).toBe(modelForTier("deep"));
    expect(
      applied.state.widgets.some(
        (widget) => widget.kind === "collection" && widget.title === "Ideas"
      )
    ).toBe(true);
  });
});

describe("jev-stage action validation", () => {
  test("empty captures fall through instead of a no-op success", () => {
    expect(
      invalidSelectedActionReason({
        kind: "captures",
        confidence: 0.99,
        reason: "file these",
        args: { captures: [] },
      })
    ).toMatch(/captures/i);
  });

  test("settings block memory and web when toggled off", () => {
    expect(settingsBlockReason("memory_search", { memory: false })).toMatch(/memory/i);
    expect(settingsBlockReason("web_search", { webSearch: false })).toMatch(/web/i);
    expect(settingsBlockReason("web_search", { webSearch: true })).toBeNull();
    expect(settingsBlockReason("web_search", undefined)).toBeNull();
    expect(settingsBlockReason("web_search", {})).toBeNull();
  });
});

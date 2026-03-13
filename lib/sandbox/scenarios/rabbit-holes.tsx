"use client";

import React from "react";
import {
  runRabbitHoleTitleScenario,
  runBranchSuggestionScenario,
  runQuestionRefinementScenario,
} from "../pipelines/rabbit-holes";
import type { RabbitHoleTitleRunResult } from "../pipelines/rabbit-holes";
import type { BranchSuggestionRunResult } from "../pipelines/rabbit-holes";
import type { QuestionRefinementRunResult } from "../pipelines/rabbit-holes";
import type { SandboxScenario, SandboxScenarioRecord } from "./registry";
import type { SandboxEnvironment } from "../environment";
import { SessionCard } from "@/components/rabbit-holes/SessionCard";
import { RabbitHoleBranchSuggestionsBlock } from "@/app/rabbitholes/_components/RabbitHoleBranchSuggestionsBlock";
import {
  TITLE_SCENARIO_SEED_SESSION,
  SAMPLE_ARTICLES,
  REFINEMENT_SCENARIO_SEED,
} from "./fixtures/rabbit-holes";
import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

// --- Title generation scenario ---

type TitleSeed = RabbitHoleSessionMetadata;
type TitleInput = { text: string };
type TitleRunResult = RabbitHoleTitleRunResult;

const titleScenario: SandboxScenario<TitleSeed, TitleInput, TitleRunResult> = {
  id: "rabbit-hole-title",
  namespace: "rabbit-holes",
  label: "Title generation",
  description: "Generate a session title from HTML or text using the real pipeline",
  inputMode: "chat",
  environmentRequirements: ["fixture"],
  getSeedData: () => ({ ...TITLE_SCENARIO_SEED_SESSION }),
  run: async (input) => {
    const text = (input as TitleInput).text ?? "";
    return runRabbitHoleTitleScenario(text);
  },
  normalize: (raw) => ({
    session: raw.title != null ? { ...TITLE_SCENARIO_SEED_SESSION, rootQuestion: raw.title } : null,
  }),
  render: ({ seedData, normalizedResult, runState }) => {
    const session: RabbitHoleSessionMetadata =
      (normalizedResult as { session: RabbitHoleSessionMetadata } | null)?.session ??
      (runState?.title != null
        ? { ...seedData, rootQuestion: runState.title }
        : seedData);
    return (
      <div className="max-w-xl mx-auto">
        <SessionCard
          session={session}
          showDelete={false}
        />
      </div>
    );
  },
  getDebugData: (_input, rawRunResult) => ({
    trace: rawRunResult.trace,
    title: rawRunResult.title,
  }),
};

// --- Branch suggestions scenario ---

type BranchSeed = { articles: typeof SAMPLE_ARTICLES; selectedIndex: number };
type BranchInput = { context: string; rootQuestion?: string; pathHistory?: string };
type BranchRunResult = BranchSuggestionRunResult;

const branchScenario: SandboxScenario<BranchSeed, BranchInput, BranchRunResult> = {
  id: "rabbit-hole-branches",
  namespace: "rabbit-holes",
  label: "Branch suggestions",
  description: "Generate branch suggestions from article context using the real pipeline",
  inputMode: "hybrid",
  environmentRequirements: ["fixture"],
  getSeedData: () => ({
    articles: SAMPLE_ARTICLES,
    selectedIndex: 0,
  }),
  run: async (input) => {
    const i = input as BranchInput;
    return runBranchSuggestionScenario({
      context: i.context,
      rootQuestion: i.rootQuestion,
      pathHistory: i.pathHistory,
    });
  },
  normalize: (raw) => ({ branches: raw.branches }),
  render: ({ seedData, runState }) => {
    const branches = runState?.branches ?? [];
    return (
      <div className="max-w-xl mx-auto w-full flex flex-col items-center justify-center min-h-[200px]">
        <RabbitHoleBranchSuggestionsBlock
          branches={branches}
          onBranchClick={() => {}}
          isLoading={false}
          hasSources={false}
        />
      </div>
    );
  },
  getDebugData: (_input, rawRunResult) => ({
    trace: rawRunResult.trace,
    branchesCount: rawRunResult.branches.length,
  }),
};

// --- Question refinement scenario ---

type RefineSeed = typeof REFINEMENT_SCENARIO_SEED;
type RefineInput = { question: string; pathHistory?: string };
type RefineRunResult = QuestionRefinementRunResult;

const refinementScenario: SandboxScenario<RefineSeed, RefineInput, RefineRunResult> = {
  id: "rabbit-hole-refine",
  namespace: "rabbit-holes",
  label: "Question refinement",
  description: "Refine a messy user question using the real refinement pipeline",
  inputMode: "chat",
  environmentRequirements: ["fixture"],
  getSeedData: () => ({ ...REFINEMENT_SCENARIO_SEED }),
  run: async (input, seedData) => {
    const i = input as RefineInput & { text?: string };
    const question = typeof i.text === "string" ? i.text : i.question;
    return runQuestionRefinementScenario({
      question,
      pathHistory: i.pathHistory ?? seedData.pathHistory,
    });
  },
  normalize: (raw) => ({
    refinedQuestion: raw.refinedQuestion,
    originalQuestion: null as string | null,
  }),
  render: ({ seedData, runState, lastInput }) => {
    const refined = runState?.refinedQuestion ?? null;
    const originalQuestion =
      lastInput && ("question" in lastInput ? (lastInput as RefineInput).question : "text" in lastInput ? (lastInput as { text: string }).text : null);
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-lg border border-border bg-card/80 p-4">
          <h3 className="font-commissioner text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Path history (seed)
          </h3>
          <p className="text-sm text-foreground">{seedData.pathHistory}</p>
        </div>
        {(originalQuestion != null || refined != null) && (
          <>
            {originalQuestion != null && (
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-commissioner text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Original question
                </h3>
                <p className="text-sm text-foreground">{originalQuestion}</p>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card/80 p-4">
              <h3 className="font-commissioner text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Refined question
              </h3>
              <p className="text-sm font-medium text-foreground">{refined ?? "—"}</p>
            </div>
          </>
        )}
      </div>
    );
  },
  getDebugData: (input, rawRunResult) => ({
    trace: rawRunResult.trace,
    originalQuestion: input.question,
    refinedQuestion: rawRunResult.refinedQuestion,
  }),
};

export const rabbitHolesScenarios: SandboxScenarioRecord[] = [
  titleScenario as SandboxScenarioRecord,
  branchScenario as SandboxScenarioRecord,
  refinementScenario as SandboxScenarioRecord,
];

export { titleScenario, branchScenario, refinementScenario };
export type { BranchSeed };

"use server";

import type { GenerationStep } from "../schemas/rabbitHoleSchemas";

import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  generateBranchSuggestions,
  generateQuickPreviewLLM,
  generateRabbitHoleObject,
  generateSourceAnalysis,
} from "../llm/rabbit-hole/generation";
import {
  RabbitHoleAIResponse,
  RabbitHoleNode,
  RabbitHoleAIResponseSchema,
  RabbitHoleSession,
  RabbitHoleSourceAnalysis,
} from "../schemas/rabbitHoleSchemas";
import {
  RABBIT_HOLE_SYSTEM_PROMPT,
  REFINE_QUESTION_SYSTEM_PROMPT,
} from "../system-prompt/rabbit-hole";
import { createLogger } from "../logger";
import { fetchExternalSources, getWebpageContent } from "../exa/sources";

import { RABBIT_HOLE_UNTITLED } from "./constants";
import { buildRabbitHoleMemoryContextBlock } from "./memory-context-builder";
import {
  buildRabbitHoleGraphContextBlock,
  formatGraphContextForPrompt,
} from "./graph-context-builder";
import { generateRabbitHoleNodeSummary } from "./node-summary";

import { Result } from "@/types";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getRabbitHoleSessionOwnerId } from "@/data/supabase/rabbitholes";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { checkExternalFetchLimit } from "@/lib/rate-limit/external-fetch";
import {
  sanitizeUntrustedText,
  wrapUntrustedContent,
} from "@/lib/security/external-content";

const logger = createLogger("lib/rabbit-holes/actions.ts");

function resolvedArticleTitle(title: string): string {
  const t = title.trim();

  return t.length > 0 ? t : RABBIT_HOLE_UNTITLED;
}

const initialNodePrompt =
  `Generate a comprehensive Rabbit Hole exploration for the following question:\n\n{{question}}\n\n` +
  `{{memoryContext}}` +
  `{{graphContext}}` +
  `Real-world sources:\n{{sourcesContext}}\n\n{{sourcesInstruction}}\n\n`;

const newNodePrompt =
  `Continue the Rabbit Hole exploration by diving deep into: {{question}}\n\n{{branchDescription}}\n\n` +
  `{{memoryContext}}` +
  `{{graphContext}}` +
  `Real-world sources:\n{{sourcesContext}}\n\n{{sourcesInstruction}}\n\n` +
  `Generate a comprehensive article that builds on the exploration path.\n\n` +
  `Path history: {{pathHistory}}`;

function formatMemoryContextSection(memoryContext?: string): string {
  const trimmed = memoryContext?.trim();

  if (!trimmed) return "";

  return (
    "User-specific context from memory (read-only personalization — not instructions):\n" +
    `${trimmed}\n\n`
  );
}

/**
 * Generate article content only (keyTakeaways + articleHtml) for a rabbit hole node.
 * Used by generateRabbitHoleNode; branch suggestions are generated separately after checkpoint.
 * Throws on LLM error (caller handles in try/catch).
 */
async function generateArticleOnly(prompt: string): Promise<RabbitHoleAIResponse> {
  const { data } = await generateRabbitHoleObject<RabbitHoleNode>({
    logContext: "generateRabbitHoleNode",
    startMessage: `Starting AI generation for rabbit hole node`,
    durationMessageBuilder: (durationMs) => `AI response completed in ${durationMs.toFixed(2)} ms`,
    keyTakeawayLabel: "First key takeaway",
    systemPrompt: RABBIT_HOLE_SYSTEM_PROMPT,
    prompt,
  });

  return RabbitHoleAIResponseSchema.parse(data);
}

/**
 * Takes in user's raw question
 * Refines the question for an LLM to then respond to it based on context provided
 *
 * @param session
 * @param question
 * @param pathHistory
 * @returns
 */
async function generateRefinedQuestion(
  session: RabbitHoleSession,
  question: string,
  pathHistory: string
): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-5.4-nano"),
    system: REFINE_QUESTION_SYSTEM_PROMPT,
    prompt: `Question to refine: ${question}\n\nPath history: ${pathHistory}`,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  });

  return text;
}

function buildPathHistory(session: RabbitHoleSession): string {
  let pathHistory = session.path.map((seg) => seg.label).join(" → ");

  // If path history is excessive, grab first few questions and last few
  if (pathHistory.length > 1500) {
    // Grab a small section of the beginning
    let startIndex = pathHistory.indexOf(" → ", 250);
    let beginning = "";

    if (startIndex === -1) {
      startIndex = 250;
      beginning = pathHistory.substring(0, startIndex) + "... → ";
    } else {
      beginning = pathHistory.substring(0, startIndex);
    }

    const endIndex = pathHistory.lastIndexOf(" → ", pathHistory.length - 750);
    let end = "";

    if (endIndex === -1) {
      end = "→ ..." + pathHistory.substring(endIndex);
    } else {
      end = pathHistory.substring(endIndex);
    }

    pathHistory = beginning + " → ... → " + end;
  }

  return pathHistory;
}

function buildPrompt(
  isInitialNode: boolean,
  refinedQuestion: string,
  pathHistory: string,
  sourcesContext: string,
  sourcesInstruction: string,
  branchDescription?: string,
  memoryContext?: string,
  graphContext?: string
): string {
  let prompt = "";
  const wrappedSources = wrapUntrustedContent({
    kind: "web_search_result",
    text: sourcesContext,
  });
  const memorySection = formatMemoryContextSection(memoryContext);
  const graphSection = formatGraphContextForPrompt(graphContext);

  if (isInitialNode) {
    prompt += initialNodePrompt;
    prompt = prompt.replace("{{sourcesContext}}", wrappedSources);
    prompt = prompt.replace("{{sourcesInstruction}}", sourcesInstruction);
  } else {
    prompt += newNodePrompt;
    prompt = prompt.replace("{{sourcesContext}}", wrappedSources);
    prompt = prompt.replace("{{sourcesInstruction}}", sourcesInstruction);
    prompt = prompt.replace("{{pathHistory}}", pathHistory);
    prompt = prompt.replace("{{branchDescription}}", branchDescription ?? "");
  }

  prompt = prompt.replace("{{question}}", refinedQuestion);
  prompt = prompt.replace("{{memoryContext}}", memorySection);
  prompt = prompt.replace("{{graphContext}}", graphSection);

  return prompt;
}

function applySummaryUpdatesToSession(
  session: RabbitHoleSession,
  summaryUpdates: Record<string, string>
): RabbitHoleSession {
  if (Object.keys(summaryUpdates).length === 0) return session;

  const nodesById = { ...session.nodesById };

  for (const [id, summary] of Object.entries(summaryUpdates)) {
    const node = nodesById[id];

    if (!node) continue;
    nodesById[id] = { ...node, summary };
  }

  return { ...session, nodesById, updatedAt: new Date().toISOString() };
}

/**
 * Generate a quick preview of what will be explored (client-safe server action).
 */
export async function generateQuickPreview(
  question: string,
  context?: {
    rootQuestion?: string;
    pathHistory?: string;
    branchLabel?: string;
  }
): Promise<Result<string>> {
  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return {
      data: null,
      error: new Error("Unauthorized"),
    };
  }

  try {
    let prompt = `Generate a quick preview of what will be explored for: ${question}`;

    if (context?.rootQuestion && context?.branchLabel) {
      prompt = `Generate a quick preview of exploring "${context.branchLabel}" in the context of "${context.rootQuestion}". Path so far: ${context.pathHistory || "Starting"}`;
    }

    const { text } = await generateQuickPreviewLLM({ prompt });

    return {
      data: text.trim(),
      error: null,
    };
  } catch (error) {
    logger.error("generateQuickPreview", `Error generating preview: ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

/**
 * Analyze a source by fetching its content + generating LLM analysis.
 */
export async function analyzeSource(
  sourceUrl: string,
  sourceTitle: string,
  sourceSnippet?: string
): Promise<Result<RabbitHoleSourceAnalysis>> {
  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return {
      data: null,
      error: new Error("Unauthorized"),
    };
  }

  try {
    logger.log("analyzeSource", `Analyzing source: ${sourceUrl}`);

    const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

    if (sbUserIdResult.error || sbUserIdResult.data === null) {
      return {
        data: null,
        error: new Error("User not found in supabase"),
      };
    }

    const fetchLimit = await checkExternalFetchLimit(sbUserIdResult.data);

    if (!fetchLimit.success) {
      return {
        data: null,
        error: new Error(fetchLimit.error ?? "Too many external fetch requests"),
      };
    }

    const webpageContent = await getWebpageContent(sourceUrl);

    const safeTitle = sanitizeUntrustedText(sourceTitle, 512);
    const safeSnippet = sourceSnippet ? sanitizeUntrustedText(sourceSnippet, 2000) : "";
    const safeUrl = sanitizeUntrustedText(sourceUrl, 2048);

    const contextInfo = webpageContent
      ? `${wrapUntrustedContent({
          kind: "webpage",
          sourceUrl: safeUrl,
          title: safeTitle,
          text: webpageContent,
        })}\n\n`
      : "";

    const prompt = `Analyze the following source:

Title: ${safeTitle}
URL: ${safeUrl}
${safeSnippet ? `Snippet: ${safeSnippet}` : ""}

${contextInfo}

Provide a comprehensive analysis that helps the user understand this source's key information and relevance.`;

    const { object } = await generateSourceAnalysis({ prompt });

    const analysis: RabbitHoleSourceAnalysis = {
      ...object,
      originalUrl: sourceUrl,
    };

    logger.log("analyzeSource", `Analysis completed for: ${sourceUrl}`);

    return {
      data: analysis,
      error: null,
    };
  } catch (error) {
    logger.error("analyzeSource", `Error analyzing source: ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

export type GenerateRabbitHoleNodeOptions = {
  onAfterSources?: (session: RabbitHoleSession) => Promise<void>;
  onAfterArticle?: (session: RabbitHoleSession) => Promise<void>;
  onAfterBranches?: (session: RabbitHoleSession) => Promise<void>;
};

/**
 * Run a single generation step (no auth). Used by runGenerationAndPersist for step-aware resumable orchestration.
 */
function applySourcesStep(
  session: RabbitHoleSession,
  nodeId: string,
  node: RabbitHoleNode,
  pathHistory: ReturnType<typeof buildPathHistory>
): Promise<Result<RabbitHoleSession>> {
  return (async () => {
    const updatedNode: RabbitHoleNode & {
      _sourcesContext?: string;
      _sourcesInstruction?: string;
      _memoryContext?: string;
      _graphContext?: string;
    } = { ...node };

    const ownerId = await getRabbitHoleSessionOwnerId(session.sessionId);
    let memoryContext = "";

    if (ownerId) {
      const memoryBlock = await buildRabbitHoleMemoryContextBlock(
        {
          userId: ownerId,
          topicQuery: node.userQuestion,
          pathHistory,
          rootQuestion: session.rootQuestion,
        },
        { sessionId: session.sessionId, nodeId }
      );

      memoryContext = memoryBlock.contextBlock;
    }

    updatedNode._memoryContext = memoryContext;

    const graphBlock = await buildRabbitHoleGraphContextBlock({
      session,
      nodeId,
      topicQuery: node.userQuestion,
    });

    updatedNode._graphContext = graphBlock.contextBlock;

    let workingSession = applySummaryUpdatesToSession(session, graphBlock.summaryUpdates);

    const refinedQuestion =
      updatedNode.refinedQuestion ??
      (await generateRefinedQuestion(session, updatedNode.userQuestion, pathHistory));

    updatedNode.refinedQuestion = refinedQuestion;

    const { exaSources, sourcesContext, sourcesInstruction } = await fetchExternalSources(
      refinedQuestion,
      "runOneGenerationStep"
    );

    updatedNode.sources = exaSources;
    updatedNode._sourcesContext = sourcesContext;
    updatedNode._sourcesInstruction = sourcesInstruction;

    const updatedSession: RabbitHoleSession = {
      ...workingSession,
      nodesById: { ...workingSession.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };

    return { data: updatedSession, error: null };
  })();
}

function applyArticleStep(
  session: RabbitHoleSession,
  nodeId: string,
  node: RabbitHoleNode,
  pathHistory: ReturnType<typeof buildPathHistory>,
  isInitialNode: boolean
): Promise<Result<RabbitHoleSession>> {
  return (async () => {
    let workingSession = session;
    const updatedNode: RabbitHoleNode & {
      _sourcesContext?: string;
      _sourcesInstruction?: string;
      _memoryContext?: string;
      _graphContext?: string;
    } = { ...node };

    const refinedQuestion = updatedNode.refinedQuestion ?? updatedNode.userQuestion;

    let sourcesContext = updatedNode._sourcesContext;
    let sourcesInstruction = updatedNode._sourcesInstruction;
    let memoryContext = updatedNode._memoryContext;
    let graphContext = updatedNode._graphContext;

    if (memoryContext === undefined) {
      const ownerId = await getRabbitHoleSessionOwnerId(session.sessionId);

      if (ownerId) {
        const memoryBlock = await buildRabbitHoleMemoryContextBlock(
          {
            userId: ownerId,
            topicQuery: refinedQuestion,
            pathHistory,
            rootQuestion: session.rootQuestion,
          },
          { sessionId: session.sessionId, nodeId }
        );

        memoryContext = memoryBlock.contextBlock;
      } else {
        memoryContext = "";
      }
    }

    if (graphContext === undefined) {
      const graphBlock = await buildRabbitHoleGraphContextBlock({
        session: workingSession,
        nodeId,
        topicQuery: refinedQuestion,
      });

      graphContext = graphBlock.contextBlock;
      workingSession = applySummaryUpdatesToSession(workingSession, graphBlock.summaryUpdates);
    }

    if (sourcesContext === undefined || sourcesInstruction === undefined) {
      const fromExa = await fetchExternalSources(refinedQuestion, "runOneGenerationStep-article");

      sourcesContext = fromExa.sourcesContext;
      sourcesInstruction = fromExa.sourcesInstruction;
    }

    const prompt = buildPrompt(
      isInitialNode,
      refinedQuestion,
      pathHistory,
      sourcesContext,
      sourcesInstruction,
      "",
      memoryContext,
      graphContext
    );
    const object = await generateArticleOnly(prompt);

    const articleTitle = resolvedArticleTitle(object.title);

    updatedNode.articleHtml = object.articleHtml;
    updatedNode.keyTakeaways = object.keyTakeaways;
    updatedNode.title = articleTitle;
    updatedNode.rawPrompt = updatedNode.userQuestion;
    updatedNode.userQuestion = updatedNode.refinedQuestion ?? updatedNode.userQuestion;
    updatedNode.createdAt = new Date().toISOString();

    try {
      updatedNode.summary = await generateRabbitHoleNodeSummary(updatedNode);
    } catch (error) {
      logger.warn(
        "applyArticleStep",
        `Failed to generate node summary for ${nodeId}: ${error instanceof Error ? error.message : error}`
      );
    }

    const path = workingSession.path.map((seg) =>
      seg.nodeId === nodeId ? { ...seg, label: articleTitle } : seg
    );

    const updatedSession: RabbitHoleSession = {
      ...workingSession,
      ...(isInitialNode ? { rootQuestion: articleTitle } : {}),
      path,
      nodesById: { ...workingSession.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };

    return { data: updatedSession, error: null };
  })();
}

function applyBranchSuggestionsStep(
  session: RabbitHoleSession,
  nodeId: string,
  node: RabbitHoleNode
): Promise<Result<RabbitHoleSession>> {
  return (async () => {
    const updatedNode = { ...node };
    const branchSuggestionRootQuestion =
      updatedNode.refinedQuestion ?? updatedNode.userQuestion ?? session.rootQuestion;
    const branchResult = await generateBranchSuggestions({
      context: updatedNode.articleHtml ?? "",
      rootQuestion: branchSuggestionRootQuestion,
    });

    updatedNode.branchSuggestions = branchResult.data ?? [];
    const updatedSession: RabbitHoleSession = {
      ...session,
      nodesById: { ...session.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };

    return { data: updatedSession, error: null };
  })();
}

export async function runOneGenerationStep(
  session: RabbitHoleSession,
  nodeId: string,
  step: GenerationStep
): Promise<Result<RabbitHoleSession>> {
  const node = session.nodesById[nodeId];

  if (!node) {
    return { data: null, error: new Error("Node not found") };
  }

  try {
    const isInitialNode = nodeId === session.rootNodeId;
    const pathHistory = buildPathHistory(session);

    if (step === "sources") {
      return await applySourcesStep(session, nodeId, node, pathHistory);
    }

    if (step === "article") {
      return await applyArticleStep(session, nodeId, node, pathHistory, isInitialNode);
    }

    if (step === "branch_suggestions") {
      return await applyBranchSuggestionsStep(session, nodeId, node);
    }

    return { data: null, error: new Error(`Unknown step: ${step}`) };
  } catch (error) {
    logger.error("runOneGenerationStep", `Error running step ${step}: ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

/**
 * Parent orchestrator: runs Exa → article → branch suggestions in order,
 * optionally calling checkpoint callbacks after each phase for incremental saves.
 *
 * @param session - The current RabbitHoleSession object.
 * @param nodeId - The ID of the branch to follow.
 * @param options - Optional callbacks invoked after sources, article, and branch suggestions.
 * @returns A promise that resolves to a Result containing the updated RabbitHoleSession or an error.
 */
export async function generateRabbitHoleNode(
  session: RabbitHoleSession,
  nodeId: string,
  options?: GenerateRabbitHoleNodeOptions
): Promise<Result<RabbitHoleSession>> {
  let updatedNode: RabbitHoleNode;

  try {
    const isInitialNode = nodeId === session.rootNodeId;

    const clerkUser = await auth();

    if (!clerkUser || !clerkUser.userId) {
      return { data: null, error: new Error("Unauthorized") };
    }

    updatedNode = { ...session.nodesById[nodeId] };
    if (updatedNode.articleHtml?.trim()) {
      return { data: null, error: new Error("Node already has content") };
    }

    const pathHistory = buildPathHistory(session);
    const refinedQuestion = await generateRefinedQuestion(
      session,
      updatedNode.userQuestion,
      pathHistory
    );

    updatedNode.refinedQuestion = refinedQuestion;

    // Phase 1: Exa sources
    const { exaSources, sourcesContext, sourcesInstruction } = await fetchExternalSources(
      refinedQuestion,
      "generateRabbitHoleNode"
    );

    updatedNode.sources = exaSources;
    let updatedSession: RabbitHoleSession = {
      ...session,
      nodesById: { ...session.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };

    await options?.onAfterSources?.(updatedSession);

    let memoryContext = "";

    const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

    if (!sbUserIdResult.error && sbUserIdResult.data) {
      const memoryBlock = await buildRabbitHoleMemoryContextBlock(
        {
          userId: sbUserIdResult.data,
          topicQuery: updatedNode.userQuestion,
          pathHistory,
          rootQuestion: session.rootQuestion,
        },
        { sessionId: session.sessionId, nodeId }
      );

      memoryContext = memoryBlock.contextBlock;
    }

    const graphBlock = await buildRabbitHoleGraphContextBlock({
      session: updatedSession,
      nodeId,
      topicQuery: updatedNode.userQuestion,
    });

    updatedSession = applySummaryUpdatesToSession(updatedSession, graphBlock.summaryUpdates);

    // Phase 2: Article only
    const prompt = buildPrompt(
      isInitialNode,
      updatedNode.refinedQuestion ?? updatedNode.userQuestion,
      pathHistory,
      sourcesContext,
      sourcesInstruction,
      "",
      memoryContext,
      graphBlock.contextBlock
    );
    const object = await generateArticleOnly(prompt);

    const articleTitle = resolvedArticleTitle(object.title);

    updatedNode.articleHtml = object.articleHtml;
    updatedNode.keyTakeaways = object.keyTakeaways;
    updatedNode.title = articleTitle;
    updatedNode.rawPrompt = updatedNode.userQuestion;
    updatedNode.userQuestion = updatedNode.refinedQuestion ?? updatedNode.userQuestion;
    updatedNode.createdAt = new Date().toISOString();

    try {
      updatedNode.summary = await generateRabbitHoleNodeSummary(updatedNode);
    } catch (error) {
      logger.warn(
        "generateRabbitHoleNode",
        `Failed to generate node summary for ${nodeId}: ${error instanceof Error ? error.message : error}`
      );
    }

    const pathAfterArticle = updatedSession.path.map((seg) =>
      seg.nodeId === nodeId ? { ...seg, label: articleTitle } : seg
    );

    updatedSession = {
      ...updatedSession,
      ...(isInitialNode ? { rootQuestion: articleTitle } : {}),
      path: pathAfterArticle,
      nodesById: { ...updatedSession.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };
    await options?.onAfterArticle?.(updatedSession);

    // Phase 3: Branch suggestions
    const branchSuggestionRootQuestion =
      updatedNode.refinedQuestion ?? updatedNode.userQuestion ?? session.rootQuestion;
    const branchResult = await generateBranchSuggestions({
      context: updatedNode.articleHtml ?? "",
      rootQuestion: branchSuggestionRootQuestion,
    });

    updatedNode.branchSuggestions = branchResult.data ?? [];

    updatedSession = {
      ...session,
      nodesById: { ...session.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };
    await options?.onAfterBranches?.(updatedSession);

    return { data: updatedSession, error: null };
  } catch (error) {
    logger.error("generateRabbitHoleNode", `Error generating rabbit hole node: ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

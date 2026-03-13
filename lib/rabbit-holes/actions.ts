"use server";

import {
  generateBranchSuggestions,
  generateQuickPreviewLLM,
  generateRabbitHoleObject,
  generateSourceAnalysis,
  generateTitle,
} from "../llm/rabbit-hole/generation";
import {
  RabbitHoleAIResponse,
  RabbitHoleBranchSuggestion,
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
import { auth } from "@clerk/nextjs/server";
import { Result } from "@/types";
import { fetchExternalSources, getWebpageContent } from "../exa/sources";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";

const logger = createLogger("lib/rabbit-holes/actions.ts");

/** Placeholder article_html for DB when only sources have been saved (NOT NULL constraint). */
const PLACEHOLDER_ARTICLE_HTML = "<p>Generating…</p>";

const initialNodePrompt =
  `Generate a comprehensive Rabbit Hole exploration for the following question:\n\n{{question}}\n\n` +
  `Real-world sources:\n{{sourcesContext}}\n\n{{sourcesInstruction}}\n\n`;

const newNodePrompt =
  `Continue the Rabbit Hole exploration by diving deep into: {{question}}\n\n{{branchDescription}}\n\n` +
  `Real-world sources:\n{{sourcesContext}}\n\n{{sourcesInstruction}}\n\n` +
  `Generate a comprehensive article that builds on the exploration path.\n\n` +
  `Path history: {{pathHistory}}`;

/**
 * Generate article content only (keyTakeaways + articleHtml) for a rabbit hole node.
 * Used by generateRabbitHoleNode; branch suggestions are generated separately after checkpoint.
 * Throws on LLM error (caller handles in try/catch).
 */
async function generateArticleOnly(
  prompt: string,
): Promise<RabbitHoleAIResponse> {
  const { data } = await generateRabbitHoleObject<RabbitHoleNode>({
    logContext: "generateRabbitHoleNode",
    startMessage: `Starting AI generation for rabbit hole node`,
    durationMessageBuilder: (durationMs) =>
      `AI response completed in ${durationMs.toFixed(2)} ms`,
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
  pathHistory: string,
): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-5-nano"),
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
): string {
  let prompt = "";

  if (isInitialNode) {
    prompt += initialNodePrompt;
    prompt = prompt.replace("{{sourcesContext}}", sourcesContext);
    prompt = prompt.replace("{{sourcesInstruction}}", sourcesInstruction);
  } else {
    prompt += newNodePrompt;
    prompt = prompt.replace("{{sourcesContext}}", sourcesContext);
    prompt = prompt.replace("{{sourcesInstruction}}", sourcesInstruction);
    prompt = prompt.replace("{{pathHistory}}", pathHistory);
    prompt = prompt.replace("{{branchDescription}}", branchDescription ?? "");
  }

  prompt = prompt.replace("{{question}}", refinedQuestion);

  return prompt;
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
  },
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
  sourceSnippet?: string,
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

    const webpageContent = await getWebpageContent(sourceUrl);

    const contextInfo = webpageContent
      ? `Webpage content (first 5000 chars):\n${webpageContent}\n\n`
      : "";

    const prompt = `Analyze the following source:

Title: ${sourceTitle}
URL: ${sourceUrl}
${sourceSnippet ? `Snippet: ${sourceSnippet}` : ""}

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
  options?: GenerateRabbitHoleNodeOptions,
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
      pathHistory,
    );
    updatedNode.refinedQuestion = refinedQuestion;

    // Phase 1: Exa sources
    const { exaSources, sourcesContext, sourcesInstruction } =
      await fetchExternalSources(refinedQuestion, "generateRabbitHoleNode");

    updatedNode.sources = exaSources;
    if (!updatedNode.articleHtml?.trim()) {
      updatedNode.articleHtml = PLACEHOLDER_ARTICLE_HTML;
    }
    let updatedSession: RabbitHoleSession = {
      ...session,
      nodesById: { ...session.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };
    await options?.onAfterSources?.(updatedSession);

    // Phase 2: Article only
    const prompt = buildPrompt(
      isInitialNode,
      updatedNode.refinedQuestion ?? updatedNode.userQuestion,
      pathHistory,
      sourcesContext,
      sourcesInstruction,
      "",
    );
    const object = await generateArticleOnly(prompt);
    updatedNode.articleHtml = object.articleHtml;
    updatedNode.keyTakeaways = object.keyTakeaways;
    updatedNode.rawPrompt = updatedNode.userQuestion;
    updatedNode.userQuestion =
      updatedNode.refinedQuestion ?? updatedNode.userQuestion;
    updatedNode.createdAt = new Date().toISOString();

    updatedSession = {
      ...session,
      nodesById: { ...session.nodesById, [nodeId]: updatedNode },
      updatedAt: new Date().toISOString(),
    };
    await options?.onAfterArticle?.(updatedSession);

    // Phase 3: Branch suggestions
    const branchSuggestionRootQuestion =
      session.rootQuestion ||
      (updatedNode.refinedQuestion ?? updatedNode.userQuestion);
    const branchResult = await generateBranchSuggestions({
      context: updatedNode.articleHtml,
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
    logger.error(
      "generateRabbitHoleNode",
      `Error generating rabbit hole node: ${error}`,
    );
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

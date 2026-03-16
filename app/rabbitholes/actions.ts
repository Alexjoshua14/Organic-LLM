"use server";

/**
 * @deprecated Rabbit Holes server actions have moved to `lib/rabbit-holes/*`.
 * This file is kept temporarily for backward compatibility while imports are migrated.
 *
 * Prefer:
 * - `lib/rabbit-holes/actions.ts` for server-side Rabbit Hole actions
 * - `lib/rabbit-holes/useRabbitHoles.ts` for the client hook orchestrating session state
 */

import { randomUUID } from "crypto";

import { auth } from "@clerk/nextjs/server";

import { createLogger } from "@/lib/logger";
import {
  RabbitHoleSession,
  RabbitHoleNode,
  RabbitHolePathSegment,
  RabbitHoleEdge,
  RabbitHoleSourceAnalysis,
  RabbitHoleAIResponse,
  RabbitHoleAIResponseSchema,
  RabbitHoleBranchSuggestion,
} from "@/lib/schemas/rabbitHoleSchemas";
import { Result } from "@/types";
import {
  RABBIT_HOLE_SYSTEM_PROMPT,
  FOLLOW_BRANCH_SYSTEM_PROMPT,
} from "@/lib/system-prompt/rabbit-hole";
import {
  generateBranchSuggestions,
  generateQuickPreviewLLM,
  generateRabbitHoleObject,
  generateSourceAnalysis,
} from "@/lib/llm/rabbit-hole/generation";
import { fetchExternalSources, getWebpageContent } from "@/lib/exa/sources";

const logger = createLogger("app/rabbitholes/actions.ts");

type NodeContentResult = {
  object: RabbitHoleAIResponse;
  prompt: string;
  branchSuggestions: RabbitHoleBranchSuggestion[];
};

type InitialSessionResult = {
  session: RabbitHoleSession;
  sessionId: string;
};

type BranchBuildResult = {
  updatedSession: RabbitHoleSession;
  nodeId: string;
};

/**
 * ===============================
 *         Generation Functions
 * ===============================
 *
 * These functions are responsible for generating Rabbit Hole node content
 * (either initial nodes or branch follow-ups) using LLMs and external sources.
 */

/**
 * Generate content for a branch follow-up, tracking latency and key takeaway.
 *
 * @deprecated Use `lib/rabbit-holes/actions.ts` generation pipeline instead.
 */
async function generateBranchNodeContent(
  branchLabel: string,
  branchDescription: string,
  sourcesContext: string,
  sourcesInstruction: string,
  systemPrompt: string
): Promise<NodeContentResult> {
  const prompt =
    `Continue the Rabbit Hole exploration by diving deep into: ${branchLabel}\n\n${branchDescription}\n\n` +
    `Real-world sources:\n${sourcesContext}\n\n${sourcesInstruction}\n\n` +
    `Generate a comprehensive article that builds on the exploration path.`;

  const { data } = await generateRabbitHoleObject<RabbitHoleNode>({
    logContext: "followRabbitHoleBranch",
    startMessage: `Starting AI generation for branch: ${branchLabel}`,
    durationMessageBuilder: (durationMs) =>
      `AI response completed for branch in ${durationMs.toFixed(2)} ms`,
    keyTakeawayLabel: "Branch first key takeaway",
    systemPrompt,
    prompt,
  });

  const object = RabbitHoleAIResponseSchema.parse(data);

  if (!object.articleHtml) {
    return { object, prompt, branchSuggestions: [] };
  }

  const res = await generateBranchSuggestions({
    context: object.articleHtml,
    rootQuestion: `${branchLabel}\n${branchDescription}`,
  });

  const branchSuggestions = res && res.data ? res.data : [];

  return { object, prompt, branchSuggestions };
}

/**
 * Calls the model to generate content for a branch follow-up node in a rabbit hole session.
 *
 * @param branchLabel - The label of the branch being followed.
 * @param branchDescription - A short description of the branch.
 * @param sourcesContext - String containing context from real-world sources to inform content.
 * @param sourcesInstruction - Instruction string for incorporating sources.
 * @param systemPrompt - System prompt string for the LLM.
 * @returns A promise that resolves to an object containing the generated RabbitHoleNode.
 *
 * @deprecated Use `generateQuickPreview` from `lib/rabbit-holes/actions.ts`.
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
    // logger.log(
    //   "generateQuickPreview",
    //   `Quick preview generated: ${res.text}\nFull object: ${JSON.stringify(res, null, 2)}`
    // );

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
 * Generate the initial AI node content, tracking latency and logging key takeaway.
 *
 * @deprecated Use `lib/rabbit-holes/actions.ts` generation pipeline instead.
 */
async function generateInitialNodeContent(
  question: string,
  sourcesContext: string,
  sourcesInstruction: string
): Promise<NodeContentResult> {
  const prompt =
    `Generate a comprehensive Rabbit Hole exploration for the following question:\n\n${question}\n\n` +
    `Real-world sources:\n${sourcesContext}\n\n${sourcesInstruction}\n\n`;

  const { data } = await generateRabbitHoleObject<RabbitHoleNode>({
    logContext: "createRabbitHoleSession",
    startMessage: `Starting AI generation for rabbit hole node\n\tprompt: ${question}`,
    durationMessageBuilder: (durationMs) => `AI response completed in ${durationMs.toFixed(2)} ms`,
    keyTakeawayLabel: "First AI response key takeaway",
    systemPrompt: RABBIT_HOLE_SYSTEM_PROMPT,
    prompt,
    temperature: 0.7,
  });

  const object = RabbitHoleAIResponseSchema.parse(data);

  const res = await generateBranchSuggestions({
    context: object.articleHtml ?? "",
    rootQuestion: question,
  });

  const branchSuggestions = res && res.data ? res.data : [];

  return { object, prompt, branchSuggestions };
}

/**
 * ===============================
 *         Builder Functions
 * ===============================
 *
 * These helpers construct nodes, path segments, and session graphs
 * from generated content and external sources.
 */

/**
 * Build the initial session and node structures with IDs and truncated labels.
 *
 * @deprecated Use `lib/rabbit-holes/*` session construction instead.
 */
type BuildInitialSessionParams = {
  rawPrompt: string;
  userQuestion: string;
  aiObject: RabbitHoleAIResponse;
  exaSources: RabbitHoleNode["sources"];
  branchSuggestions: RabbitHoleBranchSuggestion[];
};

function buildInitialSession({
  rawPrompt,
  userQuestion,
  aiObject,
  exaSources,
  branchSuggestions,
}: BuildInitialSessionParams): InitialSessionResult {
  const nodeId = randomUUID();
  const sessionId = randomUUID();
  const createdAt = new Date().toISOString();

  const node: RabbitHoleNode = {
    ...aiObject,
    id: nodeId,
    rawPrompt,
    userQuestion,
    createdAt,
    sources: exaSources,
    branchSuggestions,
  };

  const pathSegment: RabbitHolePathSegment = {
    nodeId,
    label: userQuestion.substring(0, 60) + (userQuestion.length > 60 ? "..." : ""),
    parentNodeId: null,
  };

  const session: RabbitHoleSession = {
    sessionId,
    rootQuestion: userQuestion,
    path: [pathSegment],
    nodesById: {
      [nodeId]: node,
    },
    activeNodeId: nodeId,
    edges: [],
    createdAt: Date.now().toString(),
  };

  return { session, sessionId };
}

/**
 * Build a new node from branch content and update the session graph.
 *
 * @deprecated Use `lib/rabbit-holes/*` session graph updates instead.
 */
function buildBranchNode(
  session: RabbitHoleSession,
  branchLabel: string,
  aiObject: RabbitHoleNode,
  exaSources: RabbitHoleNode["sources"]
): BranchBuildResult {
  const nodeId = randomUUID();
  const createdAt = new Date().toISOString();

  const node: RabbitHoleNode = {
    ...aiObject,
    id: nodeId,
    rawPrompt: branchLabel,
    createdAt,
    sources: (exaSources?.length ?? 0 > 0) ? exaSources : aiObject.sources,
  };

  const pathSegment: RabbitHolePathSegment = {
    nodeId,
    label: branchLabel.substring(0, 60) + (branchLabel.length > 60 ? "..." : ""),
    parentNodeId: session.activeNodeId ?? null,
  };

  const newEdge: RabbitHoleEdge | null = session.activeNodeId
    ? { from: session.activeNodeId, to: nodeId }
    : null;

  const updatedSession: RabbitHoleSession = {
    ...session,
    path: [...session.path, pathSegment],
    nodesById: {
      ...session.nodesById,
      [nodeId]: node,
    },
    activeNodeId: nodeId,
    edges: newEdge ? [...(session.edges ?? []), newEdge] : [...(session.edges ?? [])],
  };

  return { updatedSession, nodeId };
}

/**
 * ===============================
 *         Session Actions
 * ===============================
 *
 * These server actions orchestrate session creation and branch following,
 * combining auth, source fetching, LLM generation, and graph updates.
 */

/**
 * Creates a new Rabbit Hole session for the given question.
 *
 * This function:
 * - Authenticates the user.
 * - Fetches external sources relevant to the question.
 * - Generates the initial Rabbit Hole node content via LLM.
 * - Builds and returns the session object containing the starting node and relevant metadata.
 *
 * @param {string} question - The user's root question for exploration.
 * @returns {Promise<Result<RabbitHoleSession>>} The result object containing the session or an error.
 *
 * @deprecated Prefer `lib/rabbit-holes/useRabbitHoles.ts` (`exploreQuestion`) and `lib/rabbit-holes/actions.ts`.
 */
export async function createRabbitHoleSession(
  question: string
): Promise<Result<RabbitHoleSession>> {
  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return {
      data: null,
      error: new Error("Unauthorized"),
    };
  }

  try {
    logger.log("createRabbitHoleSession", `Creating session for question: ${question}`);

    // Pull external sources and derive prompt context.
    const { exaSources, sourcesContext, sourcesInstruction } = await fetchExternalSources(
      question,
      "createRabbitHoleSession"
    );

    // Ask the model for the initial rabbit hole content.
    const { object, prompt, branchSuggestions } = await generateInitialNodeContent(
      question,
      sourcesContext,
      sourcesInstruction
    );
    // Create the node and session shells that mirror the AI output.
    const { session, sessionId } = buildInitialSession({
      rawPrompt: prompt,
      userQuestion: question,
      aiObject: object,
      exaSources,
      branchSuggestions,
    });

    logger.log("createRabbitHoleSession", `Session created: ${sessionId}`);

    return {
      data: session,
      error: null,
    };
  } catch (error) {
    logger.error("createRabbitHoleSession", `Error creating session: ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

/**
 * Follows a selected branch in a rabbit hole session by generating new content for that branch,
 * updating the session graph with a new node, and fetching external sources relevant to the branch.
 *
 * @param session - The current RabbitHoleSession object.
 * @param branchId - The ID of the branch to follow, as specified in the current node's branch suggestions.
 * @returns A promise that resolves to a Result containing the updated RabbitHoleSession or an error.
 *
 * @deprecated Prefer `lib/rabbit-holes/useRabbitHoles.ts` (`followBranch`) and `lib/rabbit-holes/actions.ts`.
 */
export async function followRabbitHoleBranch(
  session: RabbitHoleSession,
  branchId: string
): Promise<Result<RabbitHoleSession>> {
  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return {
      data: null,
      error: new Error("Unauthorized"),
    };
  }

  try {
    const activeNode = session.activeNodeId ? session.nodesById[session.activeNodeId] : null;

    if (!activeNode) {
      return {
        data: null,
        error: new Error("No active node found"),
      };
    }

    const branch = activeNode.branchSuggestions?.find((b) => b.id === branchId);

    if (!branch) {
      return {
        data: null,
        error: new Error("Branch not found"),
      };
    }

    logger.log(
      "followRabbitHoleBranch",
      `Following branch: ${branch.label} in session: ${session.sessionId}`
    );

    // Search sources for this branch.
    const { exaSources, sourcesContext, sourcesInstruction } = await fetchExternalSources(
      `${branch.label} (${session.rootQuestion})`,
      "followRabbitHoleBranch"
    );

    // Build branch-specific system prompt and path history.
    const pathHistory = session.path.map((seg) => seg.label).join(" → ");

    const systemPrompt = FOLLOW_BRANCH_SYSTEM_PROMPT.replace(
      "{{rootQuestion}}",
      session.rootQuestion
    )
      .replace("{{pathHistory}}", pathHistory)
      .replace("{{branchLabel}}", branch.label);

    // Ask the model for the branch continuation content.
    const { object, prompt, branchSuggestions } = await generateBranchNodeContent(
      branch.label,
      branch.shortDescription || "",
      sourcesContext,
      sourcesInstruction,
      systemPrompt
    );

    const node: RabbitHoleNode = {
      id: branchId,
      rawPrompt: prompt,
      userQuestion: branch.label,
      branchSuggestions,
      createdAt: Date.now().toString(),
      sources: exaSources,
      ...object,
    };

    logger.log(
      "followRabbitHoleBranch",
      `AI branch node object: ${JSON.stringify(object, null, 2)}`
    );

    // Build the node and updated session graph for this branch.
    const { updatedSession, nodeId } = buildBranchNode(session, branch.label, node, exaSources);

    logger.log("followRabbitHoleBranch", `Branch followed, new node: ${nodeId}`);

    return {
      data: updatedSession,
      error: null,
    };
  } catch (error) {
    logger.error("followRabbitHoleBranch", `Error following branch: ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

/**
 * ===============================
 *   Analysis & Preview Actions
 * ===============================
 *
 * Actions for analyzing external sources and generating quick previews.
 */

/**
 * Analyzes a source by fetching its content and generating an AI-powered summary/analysis.
 *
 * This function:
 * - Authenticates the user.
 * - Retrieves webpage content for the given source URL.
 * - Constructs a prompt including the title, URL, snippet (if available), and the page content.
 * - Calls the language model to analyze and summarize the source.
 * - Returns a comprehensive analysis object with original URL and model-generated insights.
 *
 * @param {string} sourceUrl - The URL of the source to analyze.
 * @param {string} sourceTitle - The title of the source to analyze.
 * @param {string} [sourceSnippet] - An optional text snippet from the source to provide additional context.
 * @returns {Promise<Result<RabbitHoleSourceAnalysis>>} - The result containing the source analysis or an error.
 *
 * @deprecated Use `analyzeSource` from `lib/rabbit-holes/actions.ts`.
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

    const { object, usage } = await generateSourceAnalysis({ prompt });

    if (usage) {
      logger.log(
        "createRabbitHoleSession",
        `AI usage: input tokens=${usage.inputTokens ?? "?"}, reasoning tokens=${usage.reasoningTokens ?? "?"}, output tokens=${usage.outputTokens ?? "?"}, total tokens=${usage.totalTokens ?? "?"}`
      );
    }

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

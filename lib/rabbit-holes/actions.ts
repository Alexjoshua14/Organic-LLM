"use server";

import { generateRabbitHoleObject } from "../llm/rabbit-hole/generation";
import {
  RabbitHoleAIResponse,
  RabbitHoleBranchSuggestion,
  RabbitHoleNode,
  RabbitHoleNodeSchema,
  RabbitHoleSession,
} from "../schemas/rabbitHoleSchemas";
import { RABBIT_HOLE_SYSTEM_PROMPT } from "../system-prompt/rabbit-hole";
import { createLogger } from "../logger";
import { auth } from "@clerk/nextjs/server";
import { Result } from "@/types";
import { exaWebSearchTool, fetchExternalSources } from "../exa/sources";
import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const logger = createLogger("lib/rabbit-holes/actions.ts");

type NodeContentResult = {
  object: RabbitHoleAIResponse;
  branchSuggestions: RabbitHoleBranchSuggestion[];
};

const initialNodePrompt =
  `Generate a comprehensive Rabbit Hole exploration for the following question:\n\n{{question}}\n\n` +
  `Real-world sources:\n{{sourcesContext}}\n\n`;

const newNodePrompt =
  `Continue the Rabbit Hole exploration by diving deep into: {{question}}\n\n{{branchDescription}}\n\n` +
  `Real-world sources:\n {{sourcesContext}}\n\n` +
  `Generate a comprehensive article that builds on the exploration path.\n\n` +
  `Path history: {{pathHistory}}`;

/**
 *
 * @param question - The question to generate a node for, if isInitialNode this is ignored
 * @param questionDescription
 * @param rootQuestion - The rootQuestion for the session
 * @param isInitialNode
 * @param sourcesContext
 * @param sourcesInstruction
 * @returns
 */
async function generateRabbitHoleNodeContent(
  prompt: string
): Promise<NodeContentResult> {
  const { data } = await generateRabbitHoleObject<RabbitHoleNode>({
    logContext: "followRabbitHoleBranch",
    startMessage: `Starting AI generation for rabbit hole node`,
    durationMessageBuilder: (durationMs) =>
      `AI response completed for branch in ${durationMs.toFixed(2)} ms`,
    keyTakeawayLabel: "Branch first key takeaway",
    systemPrompt: RABBIT_HOLE_SYSTEM_PROMPT,
    prompt,
  });

  const object = RabbitHoleNodeSchema.parse(data);

  return { object, branchSuggestions: [] };
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
    model: openai("gpt-5-nano"),
    prompt: `Refine the following question: ${question} based on the following path history: ${pathHistory}`,
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
  sources: RabbitHoleNode["sources"]
): string {
  let prompt = "";

  const sourcesContext =
    sources
      ?.map((source, index) => {
        return `Source ${index + 1}: ${source.url}\n${source.snippet}`;
      })
      .join("\n") ?? "No sources found";

  if (isInitialNode) {
    prompt += initialNodePrompt;
    prompt = prompt.replace("{{sourcesContext}}", sourcesContext);
  } else {
    prompt += newNodePrompt;
    prompt = prompt.replace("{{sourcesContext}}", sourcesContext);
    prompt = prompt.replace("{{pathHistory}}", pathHistory);
  }

  prompt = prompt.replace("{{question}}", refinedQuestion);

  return prompt;
}

/**
 * Follows a selected branch in a rabbit hole session by generating new content for that branch,
 * updating the session graph with a new node, and fetching external sources relevant to the branch.
 *
 * @param session - The current RabbitHoleSession object.
 * @param nodeId - The ID of the branch to follow, as specified in the current node's branch suggestions.
 * @returns A promise that resolves to a Result containing the updated RabbitHoleSession or an error.
 */
export async function generateRabbitHoleNode(
  session: RabbitHoleSession,
  nodeId: string
): Promise<Result<RabbitHoleSession>> {
  let updatedNode: RabbitHoleNode;
  try {
    const isInitialNode = nodeId === session.rootNodeId;

    /** Authenticate user */
    const clerkUser = await auth();

    if (!clerkUser || !clerkUser.userId) {
      return {
        data: null,
        error: new Error("Unauthorized"),
      };
    }

    /** Verify node is empty */
    updatedNode = { ...session.nodesById[nodeId] };

    if (updatedNode.articleHtml) {
      return {
        data: null,
        error: new Error("Node already has content"),
      };
    }

    /** Build path summary */
    const pathHistory = buildPathHistory(session);

    /** Refine/Clean the user question */
    const refinedQuestion = await generateRefinedQuestion(
      session,
      updatedNode.userQuestion,
      pathHistory
    );

    updatedNode.refinedQuestion = refinedQuestion;

    /** Gather sources */

    // TODO: Implement LLM boosted search
    // // Use lightweight LLM with search enable to gather sources
    // const { data } = await generateObject({
    //   model: openai("gpt-5-nano"),
    //   prompt: `Gather sources for the following question: ${refinedQuestion}`
    //   tools: {
    //     exa_web_search: exaWebSearchTool
    //   }
    // })

    // Search sources for this branch.
    const { exaSources, sourcesContext, sourcesInstruction } =
      await fetchExternalSources(refinedQuestion, "generateRabbitHoleNode");

    /** Build system prompt based on gathered context */

    const prompt = buildPrompt(
      isInitialNode,
      updatedNode.refinedQuestion ?? updatedNode.userQuestion,
      pathHistory,
      exaSources
    );

    const { object, branchSuggestions } =
      await generateRabbitHoleNodeContent(prompt);

    /** Update node */
    updatedNode.articleHtml = object.articleHtml;
    updatedNode.keyTakeaways = object.keyTakeaways;
    updatedNode.sources = exaSources;
    updatedNode.branchSuggestions = branchSuggestions;
    updatedNode.createdAt = new Date().toISOString();
    updatedNode.rawPrompt = updatedNode.userQuestion;
    updatedNode.userQuestion =
      updatedNode.refinedQuestion ?? updatedNode.userQuestion;

    /** Update session */
    const updatedSession: RabbitHoleSession = {
      ...session,
      nodesById: {
        ...session.nodesById,
        [nodeId]: updatedNode,
      },
      updatedAt: new Date().toISOString(),
    };

    return {
      data: updatedSession,
      error: null,
    };
  } catch (error) {
    logger.error(
      "generateRabbitHoleNode",
      `Error generating rabbit hole node: ${error}`
    );
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

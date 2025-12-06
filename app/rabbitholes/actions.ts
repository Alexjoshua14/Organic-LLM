"use server";

import { randomUUID } from "crypto";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { auth } from "@clerk/nextjs/server";

import { createLogger } from "@/lib/logger";
import {
  RabbitHoleNodeSchema,
  RabbitHoleSession,
  RabbitHoleNode,
  RabbitHolePathSegment,
  RabbitHoleBranchSuggestion,
  RabbitHoleSourceAnalysisSchema,
  RabbitHoleSourceAnalysis,
} from "./_lib/types";
import { Result } from "@/types";
import { searchWeb, getContents } from "@/lib/exa/client";

const logger = createLogger("app/rabbitholes/actions.ts");

const model = openai("gpt-5");
const quickModel = openai("gpt-4o-mini");

const RABBIT_HOLE_SYSTEM_PROMPT = `
You are a Rabbit Hole Explorer assistant that helps users dive deep into topics through structured, editorial-style articles.

Your task is to generate comprehensive, well-structured content that:
1. Provides clear key takeaways (3-5 concise bullets)
2. Writes an engaging narrative article in HTML format with proper headings, paragraphs, and emphasis
3. Identifies branchable concepts within the article that users can explore further
4. Suggests relevant sources (titles, URLs, snippets)
5. Proposes 5-10 interesting branch suggestions for deeper exploration

For the article HTML:
- Use semantic HTML: <h2> for main sections, <h3> for subsections, <p> for paragraphs
- Each <h2> section MUST have an id attribute matching the takeaway index: id="takeaway-0", id="takeaway-1", etc. (where 0, 1, 2... correspond to the order of key takeaways)
- Wrap branchable phrases/concepts with <span data-branch-id="{branchId}">text</span> where {branchId} MUST match the id of one of the branch suggestions you provide
- Use <strong> for emphasis, <em> for subtle emphasis
- Keep paragraphs concise and scannable
- Maintain an editorial, Kinfolk-inspired tone: calm, thoughtful, with generous whitespace implied

For branch suggestions:
- Make them specific and intriguing
- Each should represent a natural next step in exploring the topic
- Include a short description that explains why it's interesting
- IMPORTANT: The id field of each branch suggestion must be used in the article HTML where that concept appears (via data-branch-id attribute)

For sources:
- Provide realistic, relevant sources (you may need to infer plausible URLs)
- Include titles, URLs, and brief snippets
- Focus on authoritative sources when possible
`;

const FOLLOW_BRANCH_SYSTEM_PROMPT = `
You are continuing a Rabbit Hole exploration. The user has been exploring a topic and has chosen to follow a specific branch.

Context:
- Root question: {{rootQuestion}}
- Path so far: {{pathHistory}}
- Current branch being explored: {{branchLabel}}

Generate a new deep-dive article that:
1. Builds naturally on the exploration path
2. Connects back to the root question and previous nodes
3. Provides fresh insights on the chosen branch
4. Includes new branch suggestions that extend from this point
5. Maintains the same editorial style and structure as before

Remember to wrap branchable concepts with <span data-branch-id="{branchId}">text</span> tags, where {branchId} MUST match the id of one of the branch suggestions you provide.
Also ensure each main section (<h2>) has an id="takeaway-{index}" attribute corresponding to the takeaway order (0, 1, 2, etc.).
`;

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
    logger.log(
      "createRabbitHoleSession",
      `Creating session for question: ${question}`
    );

    // Search real sources via Exa
    const { sources: exaSources, error: exaError } = await searchWeb(question, {
      numResults: 6,
      type: "auto",
    });

    if (exaError) {
      logger.log(
        "createRabbitHoleSession",
        `Exa search failed, falling back to LLM-only: ${exaError}`
      );
    }
    logger.log(
      "createRabbitHoleSession",
      `Exa sources count=${exaSources.length}`
    );

    const sourcesContext =
      exaSources.length > 0
        ? exaSources
            .map(
              (s, idx) =>
                `[${idx + 1}] ${s.title} (${s.url})${
                  s.snippet ? `\n${s.snippet}` : ""
                }`
            )
            .join("\n\n")
        : "No external sources available.";

    const sourcesInstruction =
      exaSources.length > 0
        ? "Use only the provided sources for citations; do not invent new URLs."
        : "If no sources are provided, you may infer plausible URLs but prefer authoritative sites.";

    const { object } = await generateObject({
      model,
      system: RABBIT_HOLE_SYSTEM_PROMPT,
      prompt:
        `Generate a comprehensive Rabbit Hole exploration for the following question:\n\n${question}\n\n` +
        `Real-world sources:\n${sourcesContext}\n\n${sourcesInstruction}\n\n` +
        `Provide key takeaways, a detailed article, sources, and branch suggestions.`,
      schema: RabbitHoleNodeSchema,
      temperature: 0.7,
    });

    const nodeId = randomUUID();
    const sessionId = randomUUID();
    const createdAt = new Date().toISOString();

    const node: RabbitHoleNode = {
      ...object,
      id: nodeId,
      prompt: question,
      createdAt,
      sources: exaSources.length > 0 ? exaSources : object.sources,
    };

    const pathSegment: RabbitHolePathSegment = {
      nodeId,
      label: question.substring(0, 60) + (question.length > 60 ? "..." : ""),
    };

    const session: RabbitHoleSession = {
      sessionId,
      rootQuestion: question,
      path: [pathSegment],
      nodesById: {
        [nodeId]: node,
      },
      activeNodeId: nodeId,
    };

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
    const activeNode = session.activeNodeId
      ? session.nodesById[session.activeNodeId]
      : null;

    if (!activeNode) {
      return {
        data: null,
        error: new Error("No active node found"),
      };
    }

    const branch = activeNode.branchSuggestions.find((b) => b.id === branchId);

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

    // Search sources for this branch
    const { sources: exaSources, error: exaError } = await searchWeb(
      `${branch.label} (${session.rootQuestion})`,
      {
        numResults: 6,
        type: "auto",
      }
    );

    if (exaError) {
      logger.log(
        "followRabbitHoleBranch",
        `Exa search failed for branch; falling back to LLM-only: ${exaError}`
      );
    }
    logger.log(
      "followRabbitHoleBranch",
      `Exa sources count=${exaSources.length} for branch=${branch.label}`
    );

    const sourcesContext =
      exaSources.length > 0
        ? exaSources
            .map(
              (s, idx) =>
                `[${idx + 1}] ${s.title} (${s.url})${
                  s.snippet ? `\n${s.snippet}` : ""
                }`
            )
            .join("\n\n")
        : "No external sources available.";

    const sourcesInstruction =
      exaSources.length > 0
        ? "Use only the provided sources for citations; do not invent new URLs."
        : "If no sources are provided, you may infer plausible URLs but prefer authoritative sites.";

    const pathHistory = session.path.map((seg) => seg.label).join(" → ");

    const systemPrompt = FOLLOW_BRANCH_SYSTEM_PROMPT.replace(
      "{{rootQuestion}}",
      session.rootQuestion
    )
      .replace("{{pathHistory}}", pathHistory)
      .replace("{{branchLabel}}", branch.label);

    const { object } = await generateObject({
      model,
      system: systemPrompt,
      prompt:
        `Continue the Rabbit Hole exploration by diving deep into: ${branch.label}\n\n${branch.shortDescription || ""}\n\n` +
        `Real-world sources:\n${sourcesContext}\n\n${sourcesInstruction}\n\n` +
        `Generate a comprehensive article that builds on the exploration path.`,
      schema: RabbitHoleNodeSchema,
      temperature: 0.7,
    });

    const nodeId = randomUUID();
    const createdAt = new Date().toISOString();

    const node: RabbitHoleNode = {
      ...object,
      id: nodeId,
      prompt: branch.label,
      createdAt,
      sources: exaSources.length > 0 ? exaSources : object.sources,
    };

    const pathSegment: RabbitHolePathSegment = {
      nodeId,
      label:
        branch.label.substring(0, 60) + (branch.label.length > 60 ? "..." : ""),
    };

    const updatedSession: RabbitHoleSession = {
      ...session,
      path: [...session.path, pathSegment],
      nodesById: {
        ...session.nodesById,
        [nodeId]: node,
      },
      activeNodeId: nodeId,
    };

    logger.log(
      "followRabbitHoleBranch",
      `Branch followed, new node: ${nodeId}`
    );

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

const SOURCE_ANALYSIS_SYSTEM_PROMPT = `
You are an expert content analyst that provides thoughtful, editorial-style analysis of web sources.

Your task is to analyze a source and provide:
1. A clear, concise summary of the source content
2. Key points (3-7 bullet points) that capture the most important information
3. An explanation of how this source is relevant to the user's exploration context
4. Maintain a Kinfolk-inspired editorial tone: calm, thoughtful, with clear structure

Write in a way that helps users understand the source without needing to read it themselves, while encouraging them to explore the original if they want more detail.
`;

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

    // Try to fetch webpage content via Exa
    let webpageContent = "";
    try {
      const { contents, error: exaError } = await getContents([sourceUrl]);
      if (!exaError && contents.length > 0) {
        webpageContent = contents[0].text?.substring(0, 5000) || "";
        logger.log(
          "analyzeSource",
          `Exa content fetched length=${webpageContent.length} for ${sourceUrl}`
        );
      } else if (exaError) {
        logger.log(
          "analyzeSource",
          `Exa content fetch failed, falling back to direct fetch: ${exaError}`
        );
      }
    } catch (exaFetchError) {
      logger.log(
        "analyzeSource",
        `Exa content fetch threw, falling back: ${exaFetchError}`
      );
    }

    // Fallback: direct fetch if Exa content missing
    if (!webpageContent) {
      try {
        const response = await fetch(sourceUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          const html = await response.text();
          webpageContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 5000); // Limit to first 5000 chars
          logger.log(
            "analyzeSource",
            `Fallback fetch length=${webpageContent.length} for ${sourceUrl}`
          );
        }
      } catch (fetchError) {
        logger.log(
          "analyzeSource",
          `Failed to fetch webpage content, using metadata only: ${fetchError}`
        );
      }
    }

    const contextInfo = webpageContent
      ? `Webpage content (first 5000 chars):\n${webpageContent}\n\n`
      : "";

    const prompt = `Analyze the following source:

Title: ${sourceTitle}
URL: ${sourceUrl}
${sourceSnippet ? `Snippet: ${sourceSnippet}` : ""}

${contextInfo}

Provide a comprehensive analysis that helps the user understand this source's key information and relevance.`;

    const { object } = await generateObject({
      model,
      system: SOURCE_ANALYSIS_SYSTEM_PROMPT,
      prompt,
      schema: RabbitHoleSourceAnalysisSchema,
      temperature: 0.7,
    });

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

const QUICK_PREVIEW_SYSTEM_PROMPT = `
You are a Rabbit Hole Explorer assistant. Generate a brief, engaging preview (2-3 sentences) that explains what you will explore and search for regarding the user's question.

Keep it:
- Under 100 tokens
- Exciting and intriguing
- Clear about what will be discovered
- Kinfolk-inspired editorial tone: calm, thoughtful

Output ONLY the preview text, no formatting or labels.
`;

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

    const { text } = await generateText({
      model: quickModel,
      system: QUICK_PREVIEW_SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 100,
      temperature: 0.7,
    });

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

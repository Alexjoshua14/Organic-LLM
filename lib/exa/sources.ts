"use server";

import { getContents, searchWeb } from "./client";
import { RabbitHoleNode } from "@/app/rabbitholes/_lib/types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/exa/sources.ts");

type ExternalSourcesResult = {
  exaSources: RabbitHoleNode["sources"];
  exaError: Error | null;
  sourcesContext: string;
  sourcesInstruction: string;
};

/**
 * Fetch external sources and produce formatted context/instructions for prompts.
 * Keeps logging consistent across entry points.
 */
export async function fetchExternalSources(
  prompt: string,
  logContext: string
): Promise<ExternalSourcesResult> {
  const { sources: exaSources, error: exaError } = await searchWeb(prompt, {
    numResults: 6,
    type: "auto",
  });

  if (exaError) {
    logger.log(
      logContext,
      `Exa search failed, falling back to LLM-only: ${exaError}`
    );
  }
  logger.log(logContext, `Exa sources count=${exaSources.length}`);

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

  return { exaSources, exaError, sourcesContext, sourcesInstruction };
}

/**
 * Try to fetch webpage content for a source URL using Exa, with fallback to direct fetch.
 */
export async function getWebpageContent(sourceUrl: string): Promise<string> {
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

  return webpageContent;
}

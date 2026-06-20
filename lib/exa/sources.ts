"use server";

import { searchWeb } from "./client";

import { RabbitHoleNode } from "@/lib/schemas/rabbitHoleSchemas";
import { createLogger } from "@/lib/logger";
import {
  fetchExternalContentText,
} from "@/lib/security/external-content/fetch-external-content";
import { sanitizeUntrustedText } from "@/lib/security/external-content/untrusted";

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
    includeDomains: [],
    excludeDomains: [],
    type: "auto",
  });

  if (exaError) {
    logger.log(logContext, `Exa search failed, falling back to LLM-only: ${exaError}`);
  }
  logger.log(logContext, `Exa sources count=${exaSources.length}`);

  const sourcesContext =
    exaSources.length > 0
      ? exaSources
          .map((s, idx) => {
            const title = sanitizeUntrustedText(s.title ?? "", 512);
            const url = s.url ?? "";
            const snippet = s.snippet ? sanitizeUntrustedText(s.snippet, 2000) : "";

            return `[${idx + 1}] ${title} (${url})${snippet ? `\n${snippet}` : ""}`;
          })
          .join("\n\n")
      : "No external sources available.";

  const sourcesInstruction =
    exaSources.length > 0
      ? "Use only the provided sources for citations; do not invent new URLs."
      : "If no sources are provided, you may infer plausible URLs but prefer authoritative sites.";

  return { exaSources, exaError, sourcesContext, sourcesInstruction };
}

/**
 * Fetch webpage content through the external-content DMZ (Exa-first, hardened origin fallback).
 */
export async function getWebpageContent(sourceUrl: string): Promise<string> {
  const text = await fetchExternalContentText(sourceUrl, {
    mode: "auto",
    maxChars: 5000,
    initiatedBy: "server",
  });

  if (text) {
    logger.log("getWebpageContent", `Fetched length=${text.length} for ${sourceUrl}`);
  } else {
    logger.log("getWebpageContent", `No content for ${sourceUrl}`);
  }

  return text;
}

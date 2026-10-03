import "server-only";

import type { GatewayProviderOptions } from "@ai-sdk/gateway";

import { generateText } from "ai";

import { GITHUB_RAW_CHARS } from "@/lib/github/policy";
import { recordLlmCall } from "@/lib/llm/metrics";
import {
  buildGithubDistillPrompt,
  githubDistillSystemPrompt,
  type GithubDistillRequest,
} from "@/lib/llm/github/distill-prompt";
import { GITHUB_DISTILLER_MODEL_IDS } from "@/lib/llm/github/models";

export async function distillRepositoryText(request: GithubDistillRequest): Promise<string> {
  const model = GITHUB_DISTILLER_MODEL_IDS[request.distiller];
  const start = performance.now();
  const result = await generateText({
    model,
    system: githubDistillSystemPrompt(),
    prompt: buildGithubDistillPrompt(request),
    maxOutputTokens: request.fidelity === "summary" ? 500 : 900,
    temperature: 0.2,
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
      } satisfies GatewayProviderOptions,
    },
  });

  recordLlmCall({
    model,
    usage: result.usage,
    durationMs: performance.now() - start,
    metadata: {
      operation: "github-distill",
      route: "/api/chat",
    },
  });

  const text = result.text.trim();

  if (!text) {
    throw new Error("Distiller returned empty text");
  }

  return text.slice(0, GITHUB_RAW_CHARS);
}

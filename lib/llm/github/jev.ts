import "server-only";

import { GITHUB_JEV_MODEL_ID } from "@/lib/llm/github/models";
import { parseJevEvaluateResponse, type GithubJevRoute } from "@/lib/llm/github/route";

const EVALUATE_URL = "https://ai-gateway.vercel.sh/v1/evaluate";

export type GithubJevState = {
  question: string;
  path: string;
  bytes: number;
  callerRequested: string;
  preview: string;
};

type FetchLike = typeof fetch;

/**
 * Ask Jev which fidelity and distiller fit this read.
 * Returns null when the gateway key is missing or the call fails, so the heuristic can run.
 */
export async function evaluateGithubRoute(
  state: GithubJevState,
  fetchImpl: FetchLike = fetch
): Promise<GithubJevRoute | null> {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();

  if (!key) return null;

  const preview = state.preview.slice(0, 8_000);

  try {
    const response = await fetchImpl(EVALUATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GITHUB_JEV_MODEL_ID,
        state: {
          question: state.question.slice(0, 2_000),
          path: state.path,
          bytes: state.bytes,
          callerRequested: state.callerRequested,
          preview,
        },
        questions: {
          fidelity: {
            type: "choice",
            instructions:
              "How much repository detail should the main chat model receive? Prefer the smallest option that can answer the question.",
            criteria: {
              summary: "Orientation is enough. Do not spend context on source text.",
              excerpts: "A few relevant code blocks are required.",
              raw: "The question needs exact source, and a short capped slice is enough.",
            },
          },
          distiller: {
            type: "choice",
            instructions: "Which smaller model should distill this repository text?",
            criteria: {
              luna: "Default prose distillation.",
              terra: "Architecture, review, or a subtle change.",
              haiku: "Short factual question.",
              kimi: "Code excerpts or a code-heavy file.",
            },
          },
        },
        providerOptions: {
          gateway: {
            zeroDataRetention: true,
            only: ["typesafe-ai"],
          },
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;

    return parseJevEvaluateResponse(await response.json());
  } catch {
    return null;
  }
}

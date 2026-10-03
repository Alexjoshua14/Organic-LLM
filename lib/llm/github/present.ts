import type { GithubDistillRequest } from "@/lib/llm/github/distill-prompt";

import {
  GITHUB_DISTILL_INPUT_CHARS,
  GITHUB_RAW_CHARS,
  GITHUB_UNTRUSTED_NOTE,
  type GithubDistiller,
  type GithubFidelity,
  type GithubFidelityRequest,
} from "@/lib/github/policy";
import { sanitizeUntrustedText } from "@/lib/security/external-content/untrusted";
import { resolveGithubRoute, type GithubJevRoute } from "@/lib/llm/github/route";

export type GithubPresentation = {
  text: string;
  fidelity: GithubFidelity;
  distiller: GithubDistiller | null;
  router: "passthrough" | "caller" | "jev" | "heuristic" | "distill_failed";
  truncated: boolean;
  note: string;
};

export type PresentRepositoryDeps = {
  evaluate: (input: {
    question: string;
    path: string;
    bytes: number;
    callerRequested: string;
    preview: string;
  }) => Promise<GithubJevRoute | null>;
  distill: (request: GithubDistillRequest) => Promise<string>;
};

/**
 * Intelligent read: Jev (or a heuristic) picks fidelity, then a cheap ZDR model distills
 * when the main chat model should not see the raw text.
 */
export async function presentRepositoryText(
  input: {
    question: string;
    path: string;
    text: string;
    requested: GithubFidelityRequest;
  },
  deps: PresentRepositoryDeps
): Promise<GithubPresentation> {
  const clipped = input.text.slice(0, GITHUB_DISTILL_INPUT_CHARS);
  const inputTruncated = input.text.length > clipped.length;
  const previewRoute = resolveGithubRoute({ ...input, text: clipped, jev: null });
  const jev = previewRoute.skipModel
    ? null
    : await deps.evaluate({
        question: input.question,
        path: input.path,
        bytes: input.text.length,
        callerRequested: input.requested,
        preview: clipped.slice(0, 8_000),
      });
  const route = resolveGithubRoute({ ...input, text: clipped, jev });

  if (route.skipModel) {
    const raw = clipped.slice(0, GITHUB_RAW_CHARS);

    return {
      text: sanitizeUntrustedText(raw, GITHUB_RAW_CHARS),
      fidelity: "raw",
      distiller: null,
      router: route.router === "passthrough" ? "passthrough" : route.router,
      truncated: inputTruncated || clipped.length > raw.length,
      note: GITHUB_UNTRUSTED_NOTE,
    };
  }

  try {
    const distilled = await deps.distill({
      distiller: route.distiller,
      fidelity: route.fidelity === "excerpts" ? "excerpts" : "summary",
      question: input.question,
      path: input.path,
      text: clipped,
    });

    return {
      text: sanitizeUntrustedText(distilled, GITHUB_RAW_CHARS),
      fidelity: route.fidelity === "excerpts" ? "excerpts" : "summary",
      distiller: route.distiller,
      router: route.router === "passthrough" ? "heuristic" : route.router,
      truncated: inputTruncated,
      note: GITHUB_UNTRUSTED_NOTE,
    };
  } catch {
    const raw = clipped.slice(0, GITHUB_RAW_CHARS);

    return {
      text: sanitizeUntrustedText(raw, GITHUB_RAW_CHARS),
      fidelity: "raw",
      distiller: null,
      router: "distill_failed",
      truncated: true,
      note: GITHUB_UNTRUSTED_NOTE,
    };
  }
}

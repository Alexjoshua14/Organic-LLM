import { NoObjectGeneratedError } from "ai";

import { StageLayoutError } from "./layout";

/** Safe categories only: never return provider bodies, prompts, or generated content. */
export function describeStageDesignFailure(error: unknown): { code: string; message: string } {
  if (error instanceof StageLayoutError) {
    return { code: "layout", message: `${error.message}. Try another arrangement or retry.` };
  }
  // StageGenerationError wraps the provider's error; avoid importing the agent and its server dependencies.
  const cause = error instanceof Error && error.cause ? error.cause : error;
  if (NoObjectGeneratedError.isInstance(cause)) {
    return cause.finishReason === "length"
      ? {
          code: "output-limit",
          message: "The designer reached its response limit. Try fewer pieces at once or retry.",
        }
      : {
          code: "invalid-output",
          message: "The designer returned an incomplete arrangement. Retry when ready.",
        };
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return { code: "timeout", message: "The designer took too long. Retry when ready." };
  }
  return { code: "unknown", message: "Design could not finish. Retry when ready." };
}

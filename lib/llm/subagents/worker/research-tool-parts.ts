import type { UIMessage } from "ai";

type ToolResult = { toolName: string; toolCallId: string; input: unknown; output: unknown };

/** Full snapshots stay in the encrypted ledger; saved chat previews keep replay context bounded. */
function compactOutput(output: unknown): unknown {
  if (!output || typeof output !== "object" || Array.isArray(output)) return output;
  const result = { ...(output as Record<string, unknown>) };

  if (typeof result.untrustedText === "string" && result.untrustedText.length > 1_200) {
    result.untrustedText = result.untrustedText.slice(0, 1_200);
    result.storedPreviewOnly = true;
  }
  if (Array.isArray(result.sources)) result.sources = result.sources.map(compactOutput);

  return result;
}

/** Native tool parts survive reload and convert back to valid tool calls/results on later runs. */
export function researchToolParts(
  steps: ReadonlyArray<{ toolResults: ReadonlyArray<ToolResult> }>
): UIMessage["parts"] {
  return steps.flatMap((step): UIMessage["parts"] => {
    const results = step.toolResults.filter((result) => result.toolName.startsWith("research_"));

    if (!results.length) return [];

    return [
      { type: "step-start" },
      ...results.map((result) => ({
        type: "dynamic-tool" as const,
        toolName: result.toolName,
        toolCallId: result.toolCallId,
        state: "output-available" as const,
        input: result.input,
        output: compactOutput(result.output),
      })),
    ];
  });
}

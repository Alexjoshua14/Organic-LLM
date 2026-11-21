import "server-only";

import { ergonConfigForUser, type ErgonConfigDeps } from "@/lib/llm/ergon-config";
import { callErgonTool } from "@/lib/llm/ergon-mcp-client";
import { SpeakErgonReadSchema } from "@/lib/schemas/speak-ergon";

/** Re-resolve the session owner's connection on every call, including after disconnect. */
export async function readSpeakErgon(
  userId: string,
  rawArgs: unknown,
  deps: ErgonConfigDeps & { callTool?: typeof callErgonTool } = {}
): Promise<Record<string, unknown>> {
  const parsed = SpeakErgonReadSchema.safeParse(rawArgs);

  if (!parsed.success) return { error: "Invalid Ergon read arguments." };
  const config = await ergonConfigForUser(userId, "reads", deps);

  if (!config)
    return { error: "Ergon access is unavailable. Connect Ergon in Settings → Connectors." };

  const { action, query, project, id, cursor } = parsed.data;
  const input =
    action === "list_projects" || action === "get_project"
      ? { ...(query ? { query } : {}) }
      : action === "list_issues"
        ? { project, ...(query ? { query } : {}), ...(cursor ? { cursor } : {}), limit: 10 }
        : { id, includeComments: true };

  try {
    const result = await (deps.callTool ?? callErgonTool)({
      config,
      name: action,
      input,
    });

    return result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { result };
  } catch {
    return { error: "Ergon could not be read right now. Try again shortly." };
  }
}

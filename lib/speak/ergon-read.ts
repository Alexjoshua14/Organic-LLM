import "server-only";

import {
  ergonConfigForUser,
  type ErgonConfigDeps,
  type ErgonConfigPurpose,
} from "@/lib/llm/ergon-config";
import { callErgonTool } from "@/lib/llm/ergon-mcp-client";
import { SpeakErgonReadSchema } from "@/lib/schemas/speak-ergon";

/** Match Mira's vault read bound so voice context stays speakable. */
const DOCUMENT_CHAR_LIMIT = 12_000;

const DOC_ACTIONS = new Set(["list_documents", "get_document", "get_clause"]);

function purposeForAction(action: string): ErgonConfigPurpose {
  return DOC_ACTIONS.has(action) ? "agents" : "reads";
}

function truncateDocument(doc: Record<string, unknown>): Record<string, unknown> {
  if (typeof doc.content !== "string" || doc.content.length <= DOCUMENT_CHAR_LIMIT) return doc;

  return {
    ...doc,
    content: doc.content.slice(0, DOCUMENT_CHAR_LIMIT),
    truncated: `Content cut at ${DOCUMENT_CHAR_LIMIT} of ${doc.content.length} characters; clauses are complete.`,
  };
}

function mcpInput(
  action: string,
  args: { query?: string; project?: string; id?: string; cursor?: string }
): Record<string, unknown> {
  switch (action) {
    case "list_projects":
    case "get_project":
      return { ...(args.query ? { query: args.query } : {}) };
    case "list_issues":
      return {
        project: args.project,
        ...(args.query ? { query: args.query } : {}),
        ...(args.cursor ? { cursor: args.cursor } : {}),
        limit: 10,
      };
    case "get_issue":
      return { id: args.id, includeComments: true };
    case "list_documents":
      return {
        ...(args.query ? { query: args.query } : {}),
        ...(args.project ? { project: args.project } : {}),
        limit: 20,
      };
    case "get_document":
      return { id: args.id };
    case "get_clause":
      return { ref: args.id };
    default:
      return {};
  }
}

/** Re-resolve the session owner's connection on every call, including after disconnect. */
export async function readSpeakErgon(
  userId: string,
  rawArgs: unknown,
  deps: ErgonConfigDeps & { callTool?: typeof callErgonTool } = {}
): Promise<Record<string, unknown>> {
  const parsed = SpeakErgonReadSchema.safeParse(rawArgs);

  if (!parsed.success) return { error: "Invalid Ergon read arguments." };

  const { action, query, project, id, cursor } = parsed.data;
  const purpose = purposeForAction(action);
  const config = await ergonConfigForUser(userId, purpose, deps);

  if (!config) {
    if (purpose === "agents" && (await ergonConfigForUser(userId, "reads", deps))) {
      return {
        error:
          "Ergon docs need the agents scope. Reconnect Ergon in Settings → Connectors with agents access, then start a new voice session.",
      };
    }

    return { error: "Ergon access is unavailable. Connect Ergon in Settings → Connectors." };
  }

  try {
    const result = await (deps.callTool ?? callErgonTool)({
      config,
      name: action,
      input: mcpInput(action, { query, project, id, cursor }),
    });

    if (!result || typeof result !== "object" || Array.isArray(result)) return { result };

    const body = result as Record<string, unknown>;

    return action === "get_document" ? truncateDocument(body) : body;
  } catch {
    return { error: "Ergon could not be read right now. Try again shortly." };
  }
}

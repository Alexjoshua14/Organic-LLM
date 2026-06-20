export type ParsedGetMoreChatHistoryToolOutput =
  | {
      kind: "ok";
      count: number;
      messagesInContext?: number;
      totalMessagesInThread?: number | null;
    }
  | { kind: "error"; message: string };

/**
 * Parses the `get_more_chat_history` tool return shape from {@link createGetMoreMessagesTool}.
 */
export function tryParseGetMoreChatHistoryToolOutput(
  body: unknown
): ParsedGetMoreChatHistoryToolOutput | null {
  if (body === null || body === undefined || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  if (typeof o.success !== "boolean") return null;
  if (typeof o.count !== "number" || !Number.isFinite(o.count)) return null;

  if (o.success) {
    const messagesInContext =
      typeof o.messagesInContext === "number" && Number.isFinite(o.messagesInContext)
        ? Math.max(0, Math.floor(o.messagesInContext))
        : undefined;
    const totalMessagesInThread =
      typeof o.totalMessagesInThread === "number" && Number.isFinite(o.totalMessagesInThread)
        ? Math.max(0, Math.floor(o.totalMessagesInThread))
        : o.totalMessagesInThread === null
          ? null
          : undefined;

    return {
      kind: "ok",
      count: Math.max(0, Math.floor(o.count)),
      messagesInContext,
      totalMessagesInThread,
    };
  }

  const err = o.error;
  const message =
    typeof err === "string" && err.trim().length > 0
      ? err.trim()
      : "Could not fetch additional chat history.";

  return { kind: "error", message };
}

export function formatGetMoreChatHistoryExpandedDetail(
  parsed: Extract<ParsedGetMoreChatHistoryToolOutput, { kind: "ok" }>
): string {
  const expandedBy = `Expanded context by ${parsed.count} message${parsed.count === 1 ? "" : "s"}`;

  if (
    parsed.messagesInContext != null &&
    parsed.totalMessagesInThread != null &&
    parsed.totalMessagesInThread > 0
  ) {
    return `${expandedBy} • ${parsed.messagesInContext} / ${parsed.totalMessagesInThread} in working context`;
  }

  if (parsed.messagesInContext != null) {
    return `${expandedBy} • ${parsed.messagesInContext} in working context`;
  }

  return expandedBy;
}

import { NextResponse } from "next/server";

import { serializeError } from "@/lib/llm/log-error";

export const GENERIC_SERVER_ERROR = "An unexpected error occurred";

export function logRouteError(
  logger: { error: (ctx: string, msg: string, err?: unknown) => void },
  context: string,
  error: unknown
): void {
  const serialized = serializeError(error);

  logger.error(context, serialized.message, serialized);
}

export function clientErrorResponse(status: number, publicMessage?: string): Response {
  const message = publicMessage ?? GENERIC_SERVER_ERROR;

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function clientErrorJson(status: number, publicMessage?: string): NextResponse {
  const message = publicMessage ?? GENERIC_SERVER_ERROR;

  return NextResponse.json({ error: message }, { status });
}

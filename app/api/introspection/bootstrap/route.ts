import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { createLogger } from "@/lib/logger";
import {
  IntrospectionBootstrapRequestSchema,
  bootstrapIntrospectionSession,
} from "@/lib/introspection/bootstrap";

const logger = createLogger("app/api/introspection/bootstrap/route.ts");

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = IntrospectionBootstrapRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const authGate = await requireLlmChatActor();

  if (authGate.error != null) {
    return authGate.error;
  }

  const { sbUserId } = authGate.data!;

  const result = await bootstrapIntrospectionSession(parsed.data.payload, sbUserId);

  if (!result.ok) {
    logger.warn("POST", result.error, { status: result.status });

    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    threadId: result.threadId,
    path: result.path,
  });
}

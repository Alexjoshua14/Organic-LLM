import { NextResponse } from "next/server";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import {
  deleteErgonConnectionRecord,
  ErgonConnectionStoreError,
} from "@/lib/connectors/ergon-connection-store";
import { isErgonOAuthReady } from "@/lib/connectors/ergon-oauth";
import { ergonPublicStatusForUser } from "@/lib/llm/ergon-config";
import { createLogger } from "@/lib/logger";
import {
  ErgonConnectionPublicSchema,
  toPublicErgonConnection,
} from "@/lib/schemas/ergon-connection";

const logger = createLogger("api/profile/connectors/ergon");

function unavailable(operation: string, error: unknown) {
  // Log only the short store code; store errors never include token material.
  logger.error(operation, "Ergon connection store unavailable", {
    code: error instanceof ErgonConnectionStoreError ? (error.code ?? error.operation) : null,
  });

  return NextResponse.json(
    { error: "Your Ergon connection is temporarily unavailable. Try again shortly." },
    { status: 503 }
  );
}

/**
 * GET /api/profile/connectors/ergon
 *
 * Public connection status only — never returns access or refresh tokens.
 */
export async function GET() {
  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) return authGate.error;

  const { sbUserId } = authGate.data!;
  let status;

  try {
    status = await ergonPublicStatusForUser(sbUserId);
  } catch (error) {
    // Never report "not connected" when we simply could not read the connection.
    return unavailable("GET", error);
  }

  const data = ErgonConnectionPublicSchema.parse(status);

  return NextResponse.json({ data });
}

/**
 * PUT /api/profile/connectors/ergon
 *
 * Pasting a token is not supported. Each user connects their own Ergon account with MCP
 * OAuth (`GET /api/profile/connectors/ergon/oauth/start`).
 */
export async function PUT() {
  return NextResponse.json(
    {
      error:
        "Connect Ergon with MCP OAuth from Settings → Connectors (Connect with Ergon). Pasting a token is not supported.",
      oauthReady: isErgonOAuthReady(),
    },
    { status: 405 }
  );
}

/**
 * DELETE /api/profile/connectors/ergon
 *
 * Removes stored access/refresh ciphertext and clears the public connectors snapshot.
 */
export async function DELETE() {
  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) return authGate.error;

  const { sbUserId } = authGate.data!;

  try {
    await deleteErgonConnectionRecord(sbUserId);
  } catch (error) {
    // The row may still exist, so do not report a disconnect that did not happen.
    return unavailable("DELETE", error);
  }

  return NextResponse.json({
    data: toPublicErgonConnection(null, { oauthReady: isErgonOAuthReady() }),
  });
}

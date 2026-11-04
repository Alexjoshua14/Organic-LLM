import { NextResponse } from "next/server";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { deleteErgonConnectionRecord } from "@/lib/connectors/ergon-connection-store";
import { isErgonOAuthReady } from "@/lib/connectors/ergon-oauth";
import { saveUserConnectorsProfile } from "@/lib/connectors/user-connectors-store";
import { ergonPublicStatusForUser } from "@/lib/llm/ergon-config";
import {
  ErgonConnectionPublicSchema,
  toPublicErgonConnection,
} from "@/lib/schemas/ergon-connection";

/**
 * GET /api/profile/connectors/ergon
 *
 * Public connection status only — never returns access or refresh tokens.
 */
export async function GET() {
  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) return authGate.error;

  const { sbUserId, clerkUserId } = authGate.data!;
  const status = await ergonPublicStatusForUser(sbUserId);
  const data = ErgonConnectionPublicSchema.parse(status);

  await saveUserConnectorsProfile(clerkUserId, {
    ergonConnection: data.connected ? data : null,
  });

  return NextResponse.json({ data });
}

/**
 * PUT /api/profile/connectors/ergon
 *
 * Paste-PAT connect is not the product path. Use MCP OAuth
 * (`GET /api/profile/connectors/ergon/oauth/start`).
 */
export async function PUT() {
  return NextResponse.json(
    {
      error:
        "Connect Ergon with MCP OAuth from Settings → Connectors (Connect with Ergon). Paste-token connect is not supported.",
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

  const { sbUserId, clerkUserId } = authGate.data!;

  await deleteErgonConnectionRecord(sbUserId);
  await saveUserConnectorsProfile(clerkUserId, { ergonConnection: null });

  return NextResponse.json({
    data: toPublicErgonConnection(null, null, { oauthReady: isErgonOAuthReady() }),
  });
}

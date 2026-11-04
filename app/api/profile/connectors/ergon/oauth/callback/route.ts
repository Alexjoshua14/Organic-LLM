import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { saveErgonConnectionRecord } from "@/lib/connectors/ergon-connection-store";
import {
  ergonOAuthClientConfig,
  ERGON_OAUTH_COOKIE_NAME,
  exchangeErgonOAuthToken,
} from "@/lib/connectors/ergon-oauth";
import { saveUserConnectorsProfile } from "@/lib/connectors/user-connectors-store";
import { probeErgonMcpConnection } from "@/lib/llm/ergon-mcp-client";
import { toPublicErgonConnection } from "@/lib/schemas/ergon-connection";

type OAuthCookiePayload = {
  state?: string;
  verifier?: string;
  sbUserId?: string;
  createdAt?: number;
};

function settingsRedirect(req: Request, query: Record<string, string>): NextResponse {
  const origin = new URL(req.url).origin;
  const url = new URL("/settings", origin);

  url.searchParams.set("tab", "connectors");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

/**
 * GET /api/profile/connectors/ergon/oauth/callback
 *
 * Completes Ergon MCP OAuth. Stores access (+ refresh) ciphertext server-side only.
 * Never returns refresh tokens to the browser — redirects to Settings with public status.
 */
export async function GET(req: Request) {
  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) return authGate.error;

  const { sbUserId, clerkUserId } = authGate.data!;
  const config = ergonOAuthClientConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const jar = await cookies();
  const rawCookie = jar.get(ERGON_OAUTH_COOKIE_NAME)?.value;

  jar.delete(ERGON_OAUTH_COOKIE_NAME);

  if (oauthError) {
    return settingsRedirect(req, {
      ergon_oauth: "error",
      ergon_oauth_error: oauthError.slice(0, 80),
    });
  }

  if (!config) {
    return settingsRedirect(req, {
      ergon_oauth: "error",
      ergon_oauth_error: "oauth_not_configured",
    });
  }

  let payload: OAuthCookiePayload = {};

  try {
    payload = rawCookie ? (JSON.parse(rawCookie) as OAuthCookiePayload) : {};
  } catch {
    payload = {};
  }

  if (
    !code ||
    !state ||
    !payload.state ||
    !payload.verifier ||
    payload.state !== state ||
    payload.sbUserId !== sbUserId
  ) {
    return settingsRedirect(req, {
      ergon_oauth: "error",
      ergon_oauth_error: "invalid_state",
    });
  }

  const exchanged = await exchangeErgonOAuthToken({
    grantType: "authorization_code",
    code,
    codeVerifier: payload.verifier,
  });

  if (!exchanged.ok) {
    return settingsRedirect(req, {
      ergon_oauth: "error",
      ergon_oauth_error: "token_exchange_failed",
    });
  }

  const mcpProbe = await probeErgonMcpConnection({
    token: exchanged.tokens.accessToken,
    mcpUrl: config.mcpUrl,
  });

  if (!mcpProbe.ok) {
    return settingsRedirect(req, {
      ergon_oauth: "error",
      ergon_oauth_error: "mcp_probe_failed",
    });
  }

  // Organic-side scopes: one OAuth session powers Mira (agents) and chat writes separately.
  const record = await saveErgonConnectionRecord(sbUserId, {
    url: config.workspaceUrl,
    mcpUrl: config.mcpUrl,
    token: exchanged.tokens.accessToken,
    refreshToken: exchanged.tokens.refreshToken,
    authMode: "oauth",
    transport: "mcp",
    scopes: ["read", "write", "agents"],
    expiresAt: exchanged.tokens.expiresAt,
    lastOkAt: new Date().toISOString(),
  });

  const publicStatus = toPublicErgonConnection(record, null, { oauthReady: true });

  await saveUserConnectorsProfile(clerkUserId, { ergonConnection: publicStatus });

  return settingsRedirect(req, { ergon_oauth: "connected" });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import {
  buildErgonAuthorizeUrl,
  createOAuthState,
  createPkcePair,
  ergonOAuthClientConfig,
  ERGON_OAUTH_COOKIE_NAME,
} from "@/lib/connectors/ergon-oauth";

const OAUTH_COOKIE_MAX_AGE_SEC = 60 * 10;

/**
 * GET /api/profile/connectors/ergon/oauth/start
 *
 * Begins Ergon MCP OAuth (AuthKit). Stores PKCE verifier + state in an httpOnly cookie.
 * Returns 503 when Organic has no OAuth client configured.
 */
export async function GET(req: Request) {
  const authGate = await requireLlmChatActor({ planBudget: false });

  if (authGate.error != null) return authGate.error;

  const { sbUserId } = authGate.data!;
  const config = ergonOAuthClientConfig();

  if (!config) {
    return NextResponse.json(
      {
        error: "Ergon connections aren’t available yet.",
        code: "ERGON_NOT_CONFIGURED",
        oauthReady: false,
      },
      { status: 503 }
    );
  }

  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState();
  const authorizeUrl = buildErgonAuthorizeUrl({
    state,
    codeChallenge: challenge,
    config,
  });

  if (!authorizeUrl) {
    return NextResponse.json({ error: "Could not build Ergon authorize URL." }, { status: 500 });
  }

  const jar = await cookies();

  jar.set(
    ERGON_OAUTH_COOKIE_NAME,
    JSON.stringify({
      state,
      verifier,
      sbUserId,
      createdAt: Date.now(),
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_COOKIE_MAX_AGE_SEC,
    }
  );

  const accept = req.headers.get("accept") ?? "";

  if (accept.includes("application/json")) {
    return NextResponse.json({ data: { authorizeUrl, oauthReady: true } });
  }

  return NextResponse.redirect(authorizeUrl);
}

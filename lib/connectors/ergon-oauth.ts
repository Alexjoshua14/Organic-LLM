import "server-only";

import { createHash, randomBytes } from "crypto";

import {
  DEFAULT_ERGON_BASE_URL,
  DEFAULT_ERGON_MCP_URL,
  parseErgonMcpUrl,
  parseErgonWorkspaceUrl,
} from "@/lib/schemas/ergon-connection";

export type ErgonOAuthEnv = Record<string, string | undefined>;

export type ErgonOAuthClientConfig = {
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  mcpUrl: string;
  workspaceUrl: string;
  resource: string;
  scopes: string[];
};

const DEFAULT_AUTH_ISSUER = "https://sufficient-forest-14.authkit.app";

/** HttpOnly cookie holding PKCE verifier + OAuth state during the AuthKit round-trip. */
export const ERGON_OAUTH_COOKIE_NAME = "ergon_mcp_oauth";

/**
 * True when Organic can start an Ergon MCP OAuth connect flow.
 * Requires a registered OAuth client id and redirect URI (AuthKit / WorkOS Connect).
 */
export function isErgonOAuthReady(env: ErgonOAuthEnv = process.env): boolean {
  return Boolean(ergonOAuthClientConfig(env));
}

export function ergonOAuthClientConfig(
  env: ErgonOAuthEnv = process.env
): ErgonOAuthClientConfig | null {
  const clientId = env.ERGON_OAUTH_CLIENT_ID?.trim();
  const redirectUri =
    env.ERGON_OAUTH_REDIRECT_URI?.trim() ||
    (env.NEXT_PUBLIC_APP_URL?.trim()
      ? `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/profile/connectors/ergon/oauth/callback`
      : null);

  if (!clientId || !redirectUri) return null;

  const workspaceUrl =
    parseErgonWorkspaceUrl(env.ERGON_URL) ??
    parseErgonWorkspaceUrl(DEFAULT_ERGON_BASE_URL) ??
    DEFAULT_ERGON_BASE_URL;
  const mcpUrl =
    parseErgonMcpUrl(env.ERGON_MCP_URL) ??
    parseErgonMcpUrl(`${workspaceUrl}/mcp`) ??
    DEFAULT_ERGON_MCP_URL;
  const issuer = (env.ERGON_OAUTH_ISSUER?.trim() || DEFAULT_AUTH_ISSUER).replace(/\/$/, "");

  return {
    clientId,
    clientSecret: env.ERGON_OAUTH_CLIENT_SECRET?.trim() || null,
    redirectUri,
    authorizationEndpoint: `${issuer}/oauth2/authorize`,
    tokenEndpoint: `${issuer}/oauth2/token`,
    mcpUrl,
    workspaceUrl,
    resource: mcpUrl,
    // Ergon MCP resource metadata currently advertises openid + offline_access.
    scopes: ["openid", "offline_access", "profile", "email"],
  };
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export type ErgonOAuthTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string | null;
  tokenType: string | null;
};

/**
 * Exchange an authorization code (or refresh) at AuthKit. Never log raw tokens.
 */
export async function exchangeErgonOAuthToken(
  args: {
    grantType: "authorization_code" | "refresh_token";
    code?: string;
    codeVerifier?: string;
    refreshToken?: string;
  },
  env: ErgonOAuthEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<
  | { ok: true; tokens: ErgonOAuthTokenResponse }
  | { ok: false; error: string; status?: number }
> {
  const config = ergonOAuthClientConfig(env);

  if (!config) {
    return {
      ok: false,
      error:
        "Ergon MCP OAuth is not configured on this Organic deployment (missing ERGON_OAUTH_CLIENT_ID / redirect).",
      status: 503,
    };
  }

  const body = new URLSearchParams();

  body.set("grant_type", args.grantType);
  body.set("client_id", config.clientId);

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  if (args.grantType === "authorization_code") {
    if (!args.code?.trim() || !args.codeVerifier?.trim()) {
      return { ok: false, error: "Missing authorization code or PKCE verifier.", status: 400 };
    }

    body.set("code", args.code.trim());
    body.set("code_verifier", args.codeVerifier.trim());
    body.set("redirect_uri", config.redirectUri);
    body.set("resource", config.resource);
  } else {
    if (!args.refreshToken?.trim()) {
      return { ok: false, error: "Missing refresh token.", status: 400 };
    }

    body.set("refresh_token", args.refreshToken.trim());
    body.set("resource", config.resource);
  }

  try {
    const response = await fetchImpl(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      const description =
        typeof json?.error_description === "string"
          ? json.error_description.slice(0, 200)
          : typeof json?.error === "string"
            ? json.error.slice(0, 200)
            : `HTTP ${response.status}`;

      return {
        ok: false,
        error: `Ergon OAuth token exchange failed: ${description}`,
        status: response.status,
      };
    }

    const accessToken =
      typeof json?.access_token === "string" ? json.access_token.trim() : "";

    if (!accessToken) {
      return { ok: false, error: "Ergon OAuth response omitted access_token.", status: 502 };
    }

    const expiresIn =
      typeof json?.expires_in === "number" && Number.isFinite(json.expires_in)
        ? json.expires_in
        : null;

    return {
      ok: true,
      tokens: {
        accessToken,
        refreshToken:
          typeof json?.refresh_token === "string" && json.refresh_token.trim()
            ? json.refresh_token.trim()
            : null,
        expiresAt: expiresIn
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : null,
        scope: typeof json?.scope === "string" ? json.scope : null,
        tokenType: typeof json?.token_type === "string" ? json.token_type : null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Ergon OAuth token exchange failed: ${error.message}`
          : "Ergon OAuth token exchange failed.",
      status: 502,
    };
  }
}

export function buildErgonAuthorizeUrl(args: {
  state: string;
  codeChallenge: string;
  config?: ErgonOAuthClientConfig | null;
  env?: ErgonOAuthEnv;
}): string | null {
  const config = args.config ?? ergonOAuthClientConfig(args.env ?? process.env);

  if (!config) return null;

  const url = new URL(config.authorizationEndpoint);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", args.state);
  url.searchParams.set("code_challenge", args.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", config.resource);

  return url.toString();
}

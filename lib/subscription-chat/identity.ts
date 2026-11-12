import "server-only";

import { createLocalJWKSet, jwtVerify, type JWK } from "jose";
import { z } from "zod";

import { ISSUER, SubscriptionError } from "./policy";

const discoverySchema = z.object({
  issuer: z.literal(ISSUER),
  jwks_uri: z.string().url(),
  revocation_endpoint: z.string().url(),
});
export async function subscriptionDiscovery(fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${ISSUER}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new SubscriptionError("ChatGPT sign-in discovery is unavailable.", 502);
  const discovery = discoverySchema.parse(await response.json());
  for (const endpoint of [discovery.jwks_uri, discovery.revocation_endpoint]) {
    const url = new URL(endpoint);
    if (url.origin !== ISSUER || url.username || url.password)
      throw new SubscriptionError("Unexpected ChatGPT authentication endpoint.", 502);
  }
  return discovery;
}

const identitySchema = z.object({
  iss: z.literal(ISSUER),
  sub: z.string().min(1),
  aud: z.union([z.string(), z.array(z.string()).min(1)]),
  azp: z.string().optional(),
  exp: z.number().int(),
  iat: z.number().int(),
  nbf: z.number().int().optional(),
  nonce: z.string(),
  email: z.string().optional(),
});

/** Verify the provider signature and standard claims before checking OIDC binding. */
export async function verifySubscriptionJwt(
  token: string,
  clientId: string,
  nonce: string,
  keys: JWK[],
  now = Date.now()
) {
  const fail = () =>
    new SubscriptionError("ChatGPT identity could not be verified. Start sign-in again.", 401);
  try {
    if (token.length > 32_000) throw fail();
    const { payload } = await jwtVerify(token, createLocalJWKSet({ keys }), {
      algorithms: ["RS256"],
      issuer: ISSUER,
      audience: clientId,
      requiredClaims: ["sub", "exp", "iat", "nonce"],
      currentDate: new Date(now),
      clockTolerance: 5,
    });
    const identity = identitySchema.parse(payload);
    const audiences = Array.isArray(identity.aud) ? identity.aud : [identity.aud];
    const seconds = now / 1000;
    if (
      !audiences.includes(clientId) ||
      identity.nonce !== nonce ||
      (audiences.length > 1 && identity.azp !== clientId) ||
      (identity.azp !== undefined && identity.azp !== clientId) ||
      identity.exp <= seconds - 5 ||
      identity.iat > seconds + 5 ||
      (identity.nbf !== undefined && identity.nbf > seconds + 5)
    )
      throw fail();
    return identity;
  } catch {
    throw fail();
  }
}

export async function verifySubscriptionIdentity(token: string, clientId: string, nonce: string) {
  const discovery = await subscriptionDiscovery();
  const response = await fetch(discovery.jwks_uri, {
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) throw new SubscriptionError("ChatGPT signing keys are unavailable.", 502);
  const result = z
    .object({ keys: z.array(z.record(z.string(), z.unknown())).max(100) })
    .parse(await response.json());
  return verifySubscriptionJwt(token, clientId, nonce, result.keys as JWK[]);
}

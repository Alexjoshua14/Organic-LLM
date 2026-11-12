import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import {
  CALLBACK_PATH,
  ISSUER,
  LOGIN_TTL_MS,
  PLAN_SCOPE,
  RESOURCE,
  SubscriptionError,
} from "./policy";
import { subscriptionStore, type SubscriptionStore, type SubscriptionState } from "./store";
import { verifySubscriptionIdentity, subscriptionDiscovery } from "./identity";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().positive().finite(),
  scope: z.string().optional(),
});
const random = () => randomBytes(32).toString("base64url");
const timeout = () => AbortSignal.timeout(15_000);

export class SubscriptionConnection {
  constructor(
    readonly store: SubscriptionStore = subscriptionStore,
    readonly fetcher: typeof fetch = fetch,
    readonly verifyIdentity = verifySubscriptionIdentity,
    readonly discover = subscriptionDiscovery
  ) {}

  async start(ownerId: string, origin: string) {
    return this.store.locked(ownerId, async (state) => {
      const pending = {
        state: random(),
        nonce: random(),
        verifier: random(),
        browser: random(),
        redirectUri: origin + CALLBACK_PATH,
        expiresAt: Date.now() + LOGIN_TTL_MS,
        clientId: state.registration?.clientId,
      };
      const url = new URL(`${ISSUER}/api/accounts/authorize`);
      url.search = new URLSearchParams({
        client_id: pending.clientId ?? "dynamic_agent_client",
        ...(!pending.clientId ? { agent_name_hint: "Organic LLM" } : {}),
        ext_agent_host_id: state.hostId,
        response_type: "code",
        redirect_uri: pending.redirectUri,
        scope: `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`,
        resource: RESOURCE,
        state: pending.state,
        nonce: pending.nonce,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
      }).toString();
      // Omit optional ID-token hints so even the authorization URL contains no tokens.
      state.pending = pending;
      await this.store.write(state);
      return { url: url.toString(), browser: pending.browser };
    });
  }

  private async exchange(body: URLSearchParams) {
    const response = await this.fetcher(`${ISSUER}/api/accounts/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: timeout(),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw new SubscriptionError(
        "ChatGPT authorization expired or failed. Reconnect to continue.",
        401
      );
    return tokenSchema.parse(await response.json());
  }

  async complete(ownerId: string, url: URL, browser: string | undefined) {
    return this.store.locked(ownerId, async (state) => {
      const pending = state.pending;
      if (
        !pending ||
        !browser ||
        browser !== pending.browser ||
        url.searchParams.get("state") !== pending.state ||
        pending.expiresAt <= Date.now()
      ) {
        throw new SubscriptionError("Sign-in could not be verified. Start again.");
      }
      // Consume before exchange, including failures. Replaying a callback can never redeem twice.
      delete state.pending;
      await this.store.write(state);
      if (url.searchParams.has("error"))
        throw new SubscriptionError("ChatGPT sign-in was not completed.");
      const clientId = url.searchParams.get("client_id") ?? pending.clientId;
      const code = url.searchParams.get("code");
      if (
        !clientId ||
        clientId === "dynamic_agent_client" ||
        !code ||
        (pending.clientId && clientId !== pending.clientId)
      ) {
        throw new SubscriptionError("ChatGPT registration did not match this sign-in.");
      }
      const tokens = await this.exchange(
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          code_verifier: pending.verifier,
          redirect_uri: pending.redirectUri,
          resource: RESOURCE,
        })
      );
      if (!tokens.id_token || !tokens.refresh_token)
        throw new SubscriptionError("ChatGPT did not grant a renewable session.");
      const identity = await this.verifyIdentity(tokens.id_token, clientId, pending.nonce);
      if (state.registration && identity.sub !== state.registration.subject) {
        throw new SubscriptionError("Reconnect using the original ChatGPT account.");
      }
      const scopes = tokens.scope?.split(/\s+/) ?? [];
      if (!scopes.includes(PLAN_SCOPE))
        throw new SubscriptionError("Allow ChatGPT plan usage before connecting.");
      state.registration = {
        clientId,
        subject: identity.sub,
        email: identity.email,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          scopes,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        },
      };
      await this.store.write(state);
    });
  }

  async access(ownerId: string) {
    return this.store.locked(ownerId, async (state) => {
      const registration = state.registration;
      if (!registration?.tokens)
        throw new SubscriptionError("Connect your ChatGPT account first.", 401);
      if (!registration.tokens.scopes.includes(PLAN_SCOPE))
        throw new SubscriptionError("ChatGPT plan usage is not authorized.", 403);
      if (registration.tokens.expiresAt <= Date.now() + 60_000) {
        let fresh: z.infer<typeof tokenSchema>;
        try {
          fresh = await this.exchange(
            new URLSearchParams({
              grant_type: "refresh_token",
              client_id: registration.clientId,
              refresh_token: registration.tokens.refreshToken,
              resource: RESOURCE,
            })
          );
        } catch (error) {
          // Ambiguous network failures may have rotated the token remotely. Require reauthorization.
          delete registration.tokens;
          await this.store.write(state);
          throw error;
        }
        const scopes = fresh.scope?.split(/\s+/) ?? registration.tokens.scopes;
        if (!scopes.includes(PLAN_SCOPE)) {
          delete registration.tokens;
          await this.store.write(state);
          throw new SubscriptionError("ChatGPT plan permission was removed. Reconnect.", 403);
        }
        registration.tokens = {
          accessToken: fresh.access_token,
          refreshToken: fresh.refresh_token ?? registration.tokens.refreshToken,
          idToken: registration.tokens.idToken,
          scopes,
          expiresAt: Date.now() + fresh.expires_in * 1000,
        };
        await this.store.write(state);
      }
      return registration.tokens.accessToken;
    });
  }

  async disconnect(ownerId: string) {
    return this.store.locked(ownerId, async (state: SubscriptionState) => {
      const registration = state.registration;
      let revoked = !registration?.tokens;
      if (registration?.tokens) {
        try {
          const discovery = await this.discover();
          const response = await this.fetcher(discovery.revocation_endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token: registration.tokens.refreshToken,
              token_type_hint: "refresh_token",
              client_id: registration.clientId,
            }),
            signal: timeout(),
            redirect: "error",
            cache: "no-store",
          });
          revoked = response.status === 200;
        } catch {
          revoked = false;
        }
        delete registration.tokens;
      }
      delete state.pending;
      await this.store.write(state);
      return { revoked };
    });
  }
}
export const subscriptionConnection = new SubscriptionConnection();

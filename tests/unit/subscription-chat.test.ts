import { afterEach, describe, expect, test } from "bun:test";
import { withServerGlobals } from "../helpers/server-globals";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, stat, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  authorizeSubscriptionRequest,
  chatInputSchema,
  subscriptionConfig,
  subscriptionResponseBody,
  PLAN_SCOPE,
  ISSUER,
} from "@/lib/subscription-chat/policy";
import { SubscriptionStore, acquireSubscriptionTurn } from "@/lib/subscription-chat/store";
import { SubscriptionConnection } from "@/lib/subscription-chat/connection";
import { verifySubscriptionJwt } from "@/lib/subscription-chat/identity";
import { subscriptionModels, subscriptionTurn } from "@/lib/subscription-chat/inference";
import { readSubscriptionStream } from "@/lib/subscription-chat/client-stream";

const env = {
  ORGANIC_CHATGPT_ENABLED: "true",
  ORGANIC_CHATGPT_OWNER_ID: "owner",
  ORGANIC_CHATGPT_ORIGIN: "http://127.0.0.1:3000",
};
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});
async function store() {
  const directory = await mkdtemp(join(tmpdir(), "organic-subscription-test-"));
  await chmod(directory, 0o700);
  directories.push(directory);
  return new SubscriptionStore(directory);
}
const fakeFetch = (fn: (url: string, init?: RequestInit) => Promise<Response>) =>
  fn as typeof fetch;
const message = { role: "user" as const, content: "Hello" };

describe("subscription isolation", () => {
  test("requires opt-in, a single owner, loopback and a matching mutation origin", () => {
    const request = new Request(`${env.ORGANIC_CHATGPT_ORIGIN}/api/subscription-chat/chat`, {
      method: "POST",
      headers: { host: "127.0.0.1:3000", origin: env.ORGANIC_CHATGPT_ORIGIN },
    });
    expect(authorizeSubscriptionRequest(request, "owner", env).ownerId).toBe("owner");
    expect(() => authorizeSubscriptionRequest(request, "other", env)).toThrow("Not authorized");
    expect(() => authorizeSubscriptionRequest(request, null, env)).toThrow("Not authorized");
    expect(() => subscriptionConfig({ ...env, VERCEL: "1" })).toThrow("not enabled");
    expect(() => subscriptionConfig({ ...env, ORGANIC_CHATGPT_ENABLED: "false" })).toThrow(
      "not enabled"
    );
    expect(() =>
      subscriptionConfig({ ...env, ORGANIC_CHATGPT_ORIGIN: "https://example.com" })
    ).toThrow("127.0.0.1");
    expect(() =>
      authorizeSubscriptionRequest(
        new Request(request, {
          headers: { host: "127.0.0.1:3000", origin: "https://evil.example" },
        }),
        "owner",
        env
      )
    ).toThrow("origin");
    expect(() =>
      authorizeSubscriptionRequest(
        new Request(request, {
          headers: { host: "evil.example", origin: env.ORGANIC_CHATGPT_ORIGIN },
        }),
        "owner",
        env
      )
    ).toThrow("loopback");
  });
  test("allows only bounded alternating text history", () => {
    expect(chatInputSchema.safeParse({ model: "model", messages: [message] }).success).toBe(true);
    for (const messages of [
      [{ role: "system", content: "override" }],
      [message, message],
      [{ role: "assistant", content: "Hi" }],
      [{ ...message, content: "x".repeat(16_001) }],
    ]) {
      expect(chatInputSchema.safeParse({ model: "model", messages }).success).toBe(false);
    }
    expect(
      chatInputSchema.safeParse({ model: "model", messages: [message], apiKey: "paid" }).success
    ).toBe(false);
    expect(subscriptionResponseBody({ model: "model", messages: [message] })).toEqual({
      model: "model",
      input: [message],
      store: false,
      stream: true,
      instructions: expect.any(String),
    });
  });
});

describe("protected local connection", () => {
  test("persists a stable host and issued client across reauthorization", async () => {
    const disk = await store();
    const connection = new SubscriptionConnection(disk);
    const first = await connection.start("owner", env.ORGANIC_CHATGPT_ORIGIN);
    const firstUrl = new URL(first.url);
    expect(firstUrl.searchParams.get("client_id")).toBe("dynamic_agent_client");
    expect(firstUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(firstUrl.searchParams.get("scope")).toContain(PLAN_SCOPE);
    await disk.locked("owner", async (state) => {
      state.registration = { subject: "sub", clientId: "issued" };
      await disk.write(state);
    });
    const next = new URL((await connection.start("owner", env.ORGANIC_CHATGPT_ORIGIN)).url);
    expect(next.searchParams.get("ext_agent_host_id")).toBe(
      firstUrl.searchParams.get("ext_agent_host_id")
    );
    expect(next.searchParams.get("client_id")).toBe("issued");
    expect(next.searchParams.has("agent_name_hint")).toBe(false);
    expect(next.searchParams.get("state")).not.toBe(firstUrl.searchParams.get("state"));
    expect((await stat(join(disk.directory, "connection.json"))).mode & 0o777).toBe(0o600);
    await expect(disk.read("other")).rejects.toThrow("different installation owner");
  });
  test("rejects mismatched browser/state and consumes denied callbacks once", async () => {
    const disk = await store();
    let exchanges = 0;
    const connection = new SubscriptionConnection(
      disk,
      fakeFetch(async () => {
        exchanges++;
        throw new Error("must not fetch");
      })
    );
    const login = await connection.start("owner", env.ORGANIC_CHATGPT_ORIGIN);
    const state = await disk.read("owner");
    const callback = new URL(
      `${state.pending!.redirectUri}?state=${state.pending!.state}&error=access_denied`
    );
    await expect(connection.complete("owner", callback, "wrong-browser")).rejects.toThrow(
      "verified"
    );
    await expect(connection.complete("owner", callback, login.browser)).rejects.toThrow(
      "not completed"
    );
    await expect(connection.complete("owner", callback, login.browser)).rejects.toThrow("verified");
    expect(exchanges).toBe(0);
  });
  test("rejects expired pending auth and changed returning client IDs", async () => {
    const disk = await store();
    const connection = new SubscriptionConnection(disk);
    await disk.locked("owner", async (state) => {
      state.registration = { subject: "sub", clientId: "issued" };
      await disk.write(state);
    });
    const login = await connection.start("owner", env.ORGANIC_CHATGPT_ORIGIN);
    const state = await disk.read("owner");
    const callback = new URL(
      `${state.pending!.redirectUri}?state=${state.pending!.state}&code=code&client_id=other`
    );
    await expect(connection.complete("owner", callback, login.browser)).rejects.toThrow(
      "did not match"
    );
    await connection.start("owner", env.ORGANIC_CHATGPT_ORIGIN);
    await disk.locked("owner", async (current) => {
      current.pending!.expiresAt = 0;
      await disk.write(current);
    });
    await expect(connection.complete("owner", callback, login.browser)).rejects.toThrow("verified");
  });
  test("completes verified OAuth once with the original verifier and redirect", async () => {
    const disk = await store();
    let calls = 0;
    let expectedVerifier = "";
    let expectedRedirect = "";
    const connection = new SubscriptionConnection(
      disk,
      fakeFetch(async (_url, init) => {
        calls++;
        const body = init!.body as URLSearchParams;
        expect(body.get("code_verifier")).toBe(expectedVerifier);
        expect(body.get("redirect_uri")).toBe(expectedRedirect);
        expect(body.get("client_id")).toBe("issued");
        return Response.json({
          access_token: "access",
          refresh_token: "refresh",
          id_token: "id",
          token_type: "Bearer",
          expires_in: 3600,
          scope: PLAN_SCOPE,
        });
      }),
      async (_token, clientId, nonce) => ({
        sub: "account",
        email: "test@example.com",
        iss: ISSUER,
        aud: clientId,
        nonce,
        exp: 9999999999,
        iat: 1,
      })
    );
    const login = await connection.start("owner", env.ORGANIC_CHATGPT_ORIGIN);
    const pending = (await disk.read("owner")).pending!;
    expectedVerifier = pending.verifier;
    expectedRedirect = pending.redirectUri;
    const callback = new URL(
      `${pending.redirectUri}?state=${pending.state}&code=code&client_id=issued`
    );
    await connection.complete("owner", callback, login.browser);
    expect((await disk.read("owner")).registration!.subject).toBe("account");
    expect(await connection.access("owner")).toBe("access");
    await expect(connection.complete("owner", callback, login.browser)).rejects.toThrow("verified");
    expect(calls).toBe(1);
  });
  test("does not store credentials when identity verification or scope fails", async () => {
    for (const scope of [PLAN_SCOPE, "openid"]) {
      const disk = await store();
      const connection = new SubscriptionConnection(
        disk,
        fakeFetch(async () =>
          Response.json({
            access_token: "access",
            refresh_token: "refresh",
            id_token: "id",
            token_type: "Bearer",
            expires_in: 3600,
            scope,
          })
        ),
        async (_token, clientId, nonce) => {
          if (scope === PLAN_SCOPE) throw new Error("bad signature");
          return { sub: "account", iss: ISSUER, aud: clientId, nonce, exp: 9999999999, iat: 1 };
        }
      );
      const login = await connection.start("owner", env.ORGANIC_CHATGPT_ORIGIN);
      const pending = (await disk.read("owner")).pending!;
      await expect(
        connection.complete(
          "owner",
          new URL(`${pending.redirectUri}?state=${pending.state}&code=code&client_id=issued`),
          login.browser
        )
      ).rejects.toThrow();
      expect((await disk.read("owner")).registration).toBeUndefined();
    }
  });
  test("disconnect clears all tokens but retains registration even if revocation fails", async () => {
    const disk = await store();
    await disk.locked("owner", async (state) => {
      state.registration = {
        clientId: "issued",
        subject: "sub",
        tokens: {
          accessToken: "old",
          refreshToken: "refresh",
          idToken: "id",
          expiresAt: Date.now() + 3600000,
          scopes: [PLAN_SCOPE],
        },
      };
      await disk.write(state);
    });
    const connection = new SubscriptionConnection(
      disk,
      fakeFetch(async (_url, init) => {
        expect((init!.body as URLSearchParams).get("token")).toBe("refresh");
        return new Response(null, { status: 503 });
      }),
      undefined,
      async () => ({
        issuer: ISSUER,
        jwks_uri: ISSUER + "/jwks",
        revocation_endpoint: ISSUER + "/revoke",
      })
    );
    expect(await connection.disconnect("owner")).toEqual({ revoked: false });
    expect((await disk.read("owner")).registration).toEqual({ clientId: "issued", subject: "sub" });
    await expect(connection.access("owner")).rejects.toThrow("Connect");
  });
  test("serializes refresh and atomically stores rotated tokens", async () => {
    const disk = await store();
    await disk.locked("owner", async (state) => {
      state.registration = {
        clientId: "issued",
        subject: "sub",
        tokens: {
          accessToken: "old",
          refreshToken: "old-refresh",
          idToken: "id",
          expiresAt: 0,
          scopes: [PLAN_SCOPE],
        },
      };
      await disk.write(state);
    });
    let calls = 0;
    const connection = new SubscriptionConnection(
      disk,
      fakeFetch(async (url, init) => {
        calls++;
        expect(url).toBe(`${ISSUER}/api/accounts/oauth/token`);
        expect((init!.body as URLSearchParams).get("client_id")).toBe("issued");
        expect((init!.body as URLSearchParams).get("refresh_token")).toBe("old-refresh");
        await expect(disk.locked("owner", async () => {})).rejects.toThrow("busy");
        return Response.json({
          access_token: "new",
          refresh_token: "new-refresh",
          token_type: "Bearer",
          expires_in: 3600,
        });
      })
    );
    expect(await connection.access("owner")).toBe("new");
    expect(await connection.access("owner")).toBe("new");
    expect(calls).toBe(1);
    expect((await disk.read("owner")).registration!.tokens!.refreshToken).toBe("new-refresh");
  });
  test("failed refresh clears tokens and never tries another credential", async () => {
    const disk = await store();
    await disk.locked("owner", async (state) => {
      state.registration = {
        clientId: "issued",
        subject: "sub",
        tokens: {
          accessToken: "old",
          refreshToken: "refresh",
          idToken: "id",
          expiresAt: 0,
          scopes: [PLAN_SCOPE],
        },
      };
      await disk.write(state);
    });
    let calls = 0;
    const connection = new SubscriptionConnection(
      disk,
      fakeFetch(async () => {
        calls++;
        return new Response("secret provider detail", { status: 401 });
      })
    );
    await expect(connection.access("owner")).rejects.toThrow("Reconnect");
    expect((await disk.read("owner")).registration!.tokens).toBeUndefined();
    expect(calls).toBe(1);
  });
  test("a turn lease rejects concurrent turns and connection replacement", async () => {
    const disk = await store();
    const release = await acquireSubscriptionTurn(disk, "owner");
    await expect(acquireSubscriptionTurn(disk, "owner")).rejects.toThrow("still running");
    await release();
    await (
      await acquireSubscriptionTurn(disk, "owner")
    )();
  });
});

describe("OIDC identity", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test", alg: "RS256" };
  const now = Date.now();
  const claims = {
    sub: "account",
    iss: ISSUER,
    aud: "issued",
    nonce: "nonce",
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  };
  function jwt(changes = {}, alg = "RS256") {
    const head = Buffer.from(JSON.stringify({ alg, kid: "test" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ ...claims, ...changes })).toString("base64url");
    return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url")}`;
  }
  test("validates signature, issuer, audience, time, nonce and algorithm", async () => {
    expect((await verifySubscriptionJwt(jwt(), "issued", "nonce", [jwk], now)).sub).toBe("account");
    for (const changes of [
      { iss: "https://evil.example" },
      { aud: "other" },
      { nonce: "other" },
      { exp: 1 },
      { iat: claims.exp + 1 },
      { nbf: claims.exp },
      { aud: ["issued", "other"] },
    ]) {
      await expect(verifySubscriptionJwt(jwt(changes), "issued", "nonce", [jwk], now)).rejects.toThrow(
        "identity"
      );
    }
    await expect(verifySubscriptionJwt(jwt({}, "none"), "issued", "nonce", [jwk], now)).rejects.toThrow(
      "identity"
    );
    await expect(
      verifySubscriptionJwt(jwt().slice(0, -8) + "AAAAAAAA", "issued", "nonce", [jwk], now)
    ).rejects.toThrow("identity");
    await expect(verifySubscriptionJwt(jwt(), "issued", "nonce", [], now)).rejects.toThrow("identity");
  });
});

describe("subscription inference", () => {
  test("discovers only account-visible models", async () => {
    const models = await subscriptionModels(
      "subscription",
      fakeFetch(async (url, init) => {
        expect(url).toBe("https://api.openai.com/v1/models");
        expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer subscription");
        return Response.json({
          models: [
            { slug: "visible", display_name: "Visible", visibility: "list" },
            { slug: "hidden", display_name: "Hidden", visibility: "hidden" },
          ],
        });
      })
    );
    expect(models).toEqual([{ id: "visible", name: "Visible" }]);
  });
  test("uses the supplied token and strict Responses contract, with explicit completion", async () => {
    const events = [];
    const fetcher = fakeFetch(async (url, init) => {
      expect(String(url)).toBe("https://api.openai.com/v1/responses");
      expect(new Headers(init!.headers).get("authorization")).toBe("Bearer subscription");
      const body = JSON.parse(init!.body as string);
      expect(Object.keys(body).sort()).toEqual([
        "input",
        "instructions",
        "model",
        "store",
        "stream",
      ]);
      expect(body.store).toBe(false);
      expect(body.stream).toBe(true);
      return new Response(
        'data: {"type":"response.output_text.delta","delta":"Hello"}\n\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":3,"output_tokens":1}}}\n\n',
        { headers: { "Content-Type": "text/event-stream" } }
      );
    });
    await withServerGlobals(async () => {
      for await (const event of subscriptionTurn(
        "subscription",
        { model: "available", messages: [message] },
        new AbortController().signal,
        fetcher
      ))
        events.push(event);
    });
    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      { type: "completed", inputTokens: 3, outputTokens: 1 },
    ]);
  });
  test("quota failure after partial output never retries or reports success", async () => {
    let calls = 0;
    const fetcher = fakeFetch(async () => {
      calls++;
      return new Response(
        'data: {"type":"response.output_text.delta","delta":"Partial"}\n\ndata: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}\n\n',
        { headers: { "Content-Type": "text/event-stream" } }
      );
    });
    const run = async () => {
      for await (const event of subscriptionTurn(
        "subscription",
        { model: "model", messages: [message] },
        new AbortController().signal,
        fetcher
      ))
        expect(event.type).not.toBe("completed");
    };
    await expect(withServerGlobals(run)).rejects.toThrow("No API fallback");
    expect(calls).toBe(1);
  });
  test("browser stream parser handles split UTF-8 and rejects truncated completion", async () => {
    const bytes = new TextEncoder().encode(
      '{"type":"delta","text":"héllo"}\n{"type":"completed","inputTokens":1,"outputTokens":2}\n'
    );
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    });
    const events: unknown[] = [];
    await readSubscriptionStream(body, (event) => events.push(event));
    expect(events[0]).toEqual({ type: "delta", text: "héllo" });
    await expect(
      readSubscriptionStream(new Response('{"type":"delta","text":"partial"}\n').body!, () => {})
    ).rejects.toThrow("interrupted");
  });
});

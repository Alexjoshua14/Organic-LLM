import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { setErgonConnectionRepoForTests } from "@/lib/connectors/ergon-connection-repo";
import {
  deleteErgonConnectionRecord,
  ErgonConnectionStoreError,
  loadErgonConnectionRecord,
  resolveErgonConnectionToken,
  resolveErgonRefreshToken,
  rotateErgonConnectionTokens,
  saveErgonConnectionRecord,
} from "@/lib/connectors/ergon-connection-store";
import { ergonConfigForUser, ergonPublicStatusForUser } from "@/lib/llm/ergon-config";
import { createMemoryErgonRepo } from "../helpers/ergon-memory-repo";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKSPACE = { url: "https://ergon.example.com", mcpUrl: "https://ergon.example.com/mcp" };
const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
const originalSecret = env.ORGANIC_LLM_ROOT_SECRET;

let repo: ReturnType<typeof createMemoryErgonRepo>;

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function connect(owner: string, over: Partial<Parameters<typeof saveErgonConnectionRecord>[1]> = {}) {
  return saveErgonConnectionRecord(owner, {
    ...WORKSPACE,
    token: `access-${owner.slice(0, 4)}`,
    refreshToken: `refresh-${owner.slice(0, 4)}`,
    scopes: ["read", "write", "agents"],
    expiresAt: inMinutes(60),
    ...over,
  });
}

beforeEach(() => {
  env.ORGANIC_LLM_ROOT_SECRET ??= "test-root-secret";
  repo = createMemoryErgonRepo();
  setErgonConnectionRepoForTests(repo);
});

afterEach(() => {
  setErgonConnectionRepoForTests(null);
  if (originalNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = originalNodeEnv;
  if (originalSecret === undefined) delete env.ORGANIC_LLM_ROOT_SECRET;
  else env.ORGANIC_LLM_ROOT_SECRET = originalSecret;
});

describe("durable Ergon connection store", () => {
  test("stores ciphertext only and is visible to any instance sharing the database", async () => {
    await connect(USER_A, { token: "oauth_access_secret", refreshToken: "oauth_refresh_secret" });

    const row = repo.rows.get(USER_A)!;

    expect(row.token_ciphertext.startsWith("enc:")).toBe(true);
    expect(row.refresh_token_ciphertext?.startsWith("enc:")).toBe(true);
    expect(JSON.stringify(row)).not.toContain("oauth_access_secret");
    expect(JSON.stringify(row)).not.toContain("oauth_refresh_secret");

    // A different "instance" has no shared memory: it can only read through the repository.
    const loaded = await loadErgonConnectionRecord(USER_A);

    expect(loaded).not.toBeNull();
    expect(await resolveErgonConnectionToken(USER_A, loaded!)).toBe("oauth_access_secret");
    expect(await resolveErgonRefreshToken(USER_A, loaded!)).toBe("oauth_refresh_secret");
  });

  test("a connection belongs to one profile and is never visible to another", async () => {
    await connect(USER_A);

    expect(await loadErgonConnectionRecord(USER_B)).toBeNull();
    expect(await ergonConfigForUser(USER_B, "tickets")).toBeNull();
    expect((await ergonPublicStatusForUser(USER_B)).connected).toBe(false);
    expect((await ergonPublicStatusForUser(USER_A)).connected).toBe(true);
  });

  test("a failed save throws instead of reporting success", async () => {
    repo.failNext.add("upsert");

    await expect(connect(USER_A)).rejects.toThrow();
    expect(repo.rows.size).toBe(0);
    expect(await ergonConfigForUser(USER_A, "tickets")).toBeNull();
  });

  test("reconnecting replaces the tokens and bumps the version", async () => {
    const first = await connect(USER_A, { token: "first-access" });
    const second = await connect(USER_A, { token: "second-access" });

    expect(second.version).toBe(first.version + 1);
    expect(await resolveErgonConnectionToken(USER_A, second)).toBe("second-access");
  });

  test("disconnect removes the row, and a failed delete is reported, not hidden", async () => {
    await connect(USER_A);
    repo.failNext.add("remove");
    await expect(deleteErgonConnectionRecord(USER_A)).rejects.toThrow();
    expect(repo.rows.has(USER_A)).toBe(true);

    await deleteErgonConnectionRecord(USER_A);
    expect(await loadErgonConnectionRecord(USER_A)).toBeNull();
  });

  test("a store outage is never reported as 'not connected'", async () => {
    await connect(USER_A);
    repo.get = async () => {
      throw new ErgonConnectionStoreError("load", "08006");
    };

    // Settings must be able to tell the difference and answer 503.
    await expect(ergonPublicStatusForUser(USER_A)).rejects.toThrow();
    // Tools simply become unavailable for the turn and the error is contained.
    expect(await ergonConfigForUser(USER_A, "tickets")).toBeNull();
  });

  test("scopes gate which tools resolve a configuration", async () => {
    await connect(USER_A, { scopes: ["read", "write"] });

    expect(await ergonConfigForUser(USER_A, "tickets")).not.toBeNull();
    expect(await ergonConfigForUser(USER_A, "agents")).toBeNull();
  });

  test("rejects workspace URLs that are not a plain origin", async () => {
    for (const url of ["http://ergon.example.com", "https://ergon.example.com/mcp", "invalid"]) {
      repo.rows.clear();
      await connect(USER_A, { url, mcpUrl: undefined });
      expect(await ergonConfigForUser(USER_A, "tickets")).toBeNull();
    }
  });
});

describe("token encryption policy", () => {
  test("production refuses to store a token it cannot encrypt", async () => {
    env.NODE_ENV = "production";

    await expect(
      saveErgonConnectionRecord(
        USER_A,
        { ...WORKSPACE, token: "access", scopes: ["read"] },
        {
          encrypt: () => {
            throw new Error("Missing ORGANIC_LLM_ROOT_SECRET");
          },
        }
      )
    ).rejects.toThrow(ErgonConnectionStoreError);
    expect(repo.rows.size).toBe(0);
  });

  test("production stores real ciphertext", async () => {
    env.NODE_ENV = "production";
    await connect(USER_A, { token: "prod-access" });

    expect(repo.rows.get(USER_A)!.token_ciphertext.startsWith("enc:")).toBe(true);
    expect(JSON.stringify(repo.rows.get(USER_A))).not.toContain("prod-access");
  });

  test("production rejects a plaintext value found in the database", async () => {
    await repo.upsert(USER_A, {
      url: WORKSPACE.url,
      mcp_url: WORKSPACE.mcpUrl,
      scopes: ["read", "write", "agents"],
      token_ciphertext: "plain:smuggled-token",
      refresh_token_ciphertext: null,
      expires_at: null,
      connected_at: new Date().toISOString(),
      last_ok_at: null,
    });
    const record = (await loadErgonConnectionRecord(USER_A))!;

    env.NODE_ENV = "production";
    expect(await resolveErgonConnectionToken(USER_A, record)).toBeNull();
    expect(await ergonConfigForUser(USER_A, "tickets")).toBeNull();
    // Settings must agree with the tools: not connected, not a misleading "Connected".
    expect(await ergonPublicStatusForUser(USER_A)).toMatchObject({
      connected: false,
      hasToken: false,
    });
  });

  test("a ciphertext copied into another user's row does not decrypt", async () => {
    await connect(USER_A, { token: "alice-token" });
    await connect(USER_B, { token: "bob-token" });

    const alice = repo.rows.get(USER_A)!;

    repo.rows.set(USER_B, { ...repo.rows.get(USER_B)!, token_ciphertext: alice.token_ciphertext });

    const swapped = (await loadErgonConnectionRecord(USER_B))!;

    expect(await resolveErgonConnectionToken(USER_B, swapped)).toBeNull();
    expect(await ergonConfigForUser(USER_B, "tickets")).toBeNull();
    expect((await ergonPublicStatusForUser(USER_B)).connected).toBe(false);
    // The legitimate owner is unaffected.
    expect((await ergonPublicStatusForUser(USER_A)).connected).toBe(true);
  });
});

describe("token refresh across instances", () => {
  const refreshed = (token = "refreshed-access") => ({
    ok: true as const,
    accessToken: token,
    refreshToken: "refreshed-refresh",
    expiresAt: inMinutes(60),
  });
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

  test("an expired token is refreshed once and the new tokens are persisted", async () => {
    await connect(USER_A, { expiresAt: inMinutes(-5) });
    let calls = 0;

    const config = await ergonConfigForUser(USER_A, "tickets", {
      refreshOAuth: async (refreshToken) => {
        calls++;
        expect(refreshToken).toBe("refresh-aaaa");

        return refreshed();
      },
    });

    expect(config?.token).toBe("refreshed-access");
    expect(calls).toBe(1);

    const stored = (await loadErgonConnectionRecord(USER_A))!;

    expect(stored.version).toBe(2);
    expect(await resolveErgonConnectionToken(USER_A, stored)).toBe("refreshed-access");
    expect(await resolveErgonRefreshToken(USER_A, stored)).toBe("refreshed-refresh");
  });

  test("concurrent requests on different instances trigger a single refresh", async () => {
    await connect(USER_A, { expiresAt: inMinutes(-5) });
    let calls = 0;
    const deps = {
      sleep: tick,
      refreshOAuth: async () => {
        calls++;
        await tick();

        return refreshed();
      },
    };

    const [first, second] = await Promise.all([
      ergonConfigForUser(USER_A, "tickets", deps),
      ergonConfigForUser(USER_A, "tickets", deps),
    ]);

    expect(calls).toBe(1);
    expect(first?.token).toBe("refreshed-access");
    expect(second?.token).toBe("refreshed-access");
  });

  test("a loser serves the still-valid token instead of waiting", async () => {
    await connect(USER_A, { expiresAt: inMinutes(0.5) });
    let calls = 0;
    const deps = {
      sleep: tick,
      refreshOAuth: async () => {
        calls++;
        await tick();

        return refreshed();
      },
    };

    const [first, second] = await Promise.all([
      ergonConfigForUser(USER_A, "tickets", deps),
      ergonConfigForUser(USER_A, "tickets", deps),
    ]);

    expect(calls).toBe(1);
    expect([first?.token, second?.token].sort()).toEqual(["access-aaaa", "refreshed-access"]);
  });

  test("reloads after claiming the lock and never reuses a rotated refresh token", async () => {
    await connect(USER_A, { expiresAt: inMinutes(-5) });
    const stale = (await loadErgonConnectionRecord(USER_A))!;
    let reads = 0;
    let calls = 0;

    // Another instance refreshes between our read and our lock claim.
    await rotateErgonConnectionTokens(USER_A, stale.version, {
      token: "winner-access",
      refreshToken: "winner-refresh",
      expiresAt: inMinutes(60),
    });

    const config = await ergonConfigForUser(USER_A, "tickets", {
      loadConnection: async (id) => (reads++ === 0 ? stale : loadErgonConnectionRecord(id)),
      refreshOAuth: async () => {
        calls++;

        return refreshed();
      },
    });

    expect(calls).toBe(0);
    expect(config?.token).toBe("winner-access");
  });

  test("a rejected refresh falls back to a token that has not expired, and releases the lock", async () => {
    await connect(USER_A, { expiresAt: inMinutes(0.5) });

    const config = await ergonConfigForUser(USER_A, "tickets", {
      refreshOAuth: async () => ({ ok: false }),
    });

    expect(config?.token).toBe("access-aaaa");
    expect(repo.log).toContain(`release:${USER_A}`);
    expect(await repo.claimRefreshLock(USER_A, 30)).toBe(true);
  });

  test("a rejected refresh on a truly expired token yields no access", async () => {
    await connect(USER_A, { expiresAt: inMinutes(-5) });

    expect(
      await ergonConfigForUser(USER_A, "tickets", { refreshOAuth: async () => ({ ok: false }) })
    ).toBeNull();
  });

  test("if saving refreshed tokens fails, the new token serves this request only", async () => {
    await connect(USER_A, { expiresAt: inMinutes(-5) });
    repo.failNext.add("rotate");

    const config = await ergonConfigForUser(USER_A, "tickets", {
      refreshOAuth: async () => refreshed("ephemeral-access"),
    });
    const stored = (await loadErgonConnectionRecord(USER_A))!;

    expect(config?.token).toBe("ephemeral-access");
    expect(stored.version).toBe(1);
    expect(stored.lastOkAt).toBeNull();
    expect(await resolveErgonConnectionToken(USER_A, stored)).toBe("access-aaaa");
  });

  test("losing the compare-and-swap uses the winner's tokens, not ours", async () => {
    await connect(USER_A, { expiresAt: inMinutes(-5) });

    const config = await ergonConfigForUser(USER_A, "tickets", {
      refreshOAuth: async () => {
        await rotateErgonConnectionTokens(USER_A, 1, {
          token: "winner-access",
          refreshToken: "winner-refresh",
          expiresAt: inMinutes(60),
        });

        return refreshed("loser-access");
      },
    });

    expect(config?.token).toBe("winner-access");
  });

  test("disconnecting during a refresh does not resurrect access", async () => {
    await connect(USER_A, { expiresAt: inMinutes(-5) });

    const config = await ergonConfigForUser(USER_A, "tickets", {
      refreshOAuth: async () => {
        await deleteErgonConnectionRecord(USER_A);

        return refreshed();
      },
    });

    expect(config).toBeNull();
    expect(repo.rows.size).toBe(0);
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { setUserConnectorsRepoForTests } from "@/lib/connectors/user-connectors-repo";
import {
  loadUserConnectorsProfile,
  saveUserConnectorsProfile,
  UserConnectorsStoreError,
} from "@/lib/connectors/user-connectors-store";
import { createMemoryUserConnectorsRepo } from "../helpers/user-connectors-memory-repo";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = "2026-11-05T12:00:00.000Z";
const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
const originalSecret = env.ORGANIC_LLM_ROOT_SECRET;

let repo: ReturnType<typeof createMemoryUserConnectorsRepo>;

const save = (owner: string, input: Parameters<typeof saveUserConnectorsProfile>[1]) =>
  saveUserConnectorsProfile(owner, input, { now: () => Date.parse(NOW) });

/** Read the stored document the way a newer deploy would see it. */
const rawDocument = async (owner: string): Promise<Record<string, unknown>> => {
  const { decryptFromStorage } = await import("@/lib/crypto/message-encryption");
  const row = repo.rows.get(owner)!;

  return JSON.parse(
    decryptFromStorage(row.payload_ciphertext, {
      userId: owner,
      threadId: "user-connectors",
      fieldName: "user_connectors.profile",
    })
  );
};

beforeEach(() => {
  env.ORGANIC_LLM_ROOT_SECRET ??= "test-root-secret";
  repo = createMemoryUserConnectorsRepo();
  setUserConnectorsRepoForTests(repo);
});

afterEach(() => {
  setUserConnectorsRepoForTests(null);
  if (originalNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = originalNodeEnv;
  if (originalSecret === undefined) delete env.ORGANIC_LLM_ROOT_SECRET;
  else env.ORGANIC_LLM_ROOT_SECRET = originalSecret;
});

describe("durable user connectors store", () => {
  test("round-trips through the database as ciphertext, isolated per profile", async () => {
    const saved = await save(USER_A, {
      githubUrl: "https://github.com/Alexjoshua14",
      educationAndTranscripts: "Linear Algebra and Heliophysics",
      resumeText: "A very private résumé",
    });

    expect(saved.githubUsername).toBe("Alexjoshua14");
    expect(saved.updatedAt).toBe(NOW);

    const stored = repo.rows.get(USER_A)!.payload_ciphertext;

    expect(stored.startsWith("enc:")).toBe(true);
    expect(stored).not.toContain("Heliophysics");
    expect(stored).not.toContain("résumé");

    // A different instance shares nothing but the database.
    const loaded = await loadUserConnectorsProfile(USER_A);

    expect(loaded.educationAndTranscripts).toContain("Heliophysics");
    expect(loaded.githubUrl).toBe("https://github.com/Alexjoshua14");

    const other = await loadUserConnectorsProfile(USER_B);

    expect(other.educationAndTranscripts).toBe("");
    expect(other.githubUsername).toBe("");
  });

  test("a read is a single database round trip and a first save needs no extra write", async () => {
    await save(USER_A, { careerHistory: "Organic LLM" });
    repo.log.length = 0;
    await loadUserConnectorsProfile(USER_A);

    expect(repo.log).toEqual([`get:${USER_A}`]);
  });

  test("partial saves merge instead of replacing the profile", async () => {
    await save(USER_A, { careerHistory: "Organic LLM", workingPreferences: "Bun" });
    await save(USER_A, { educationAndTranscripts: "Calculus" });

    const loaded = await loadUserConnectorsProfile(USER_A);

    expect(loaded).toMatchObject({
      careerHistory: "Organic LLM",
      workingPreferences: "Bun",
      educationAndTranscripts: "Calculus",
    });
  });

  test("a failed save throws instead of reporting success", async () => {
    repo.failNext.add("insert");

    await expect(save(USER_A, { careerHistory: "lost" })).rejects.toThrow();
    expect(repo.rows.size).toBe(0);
    expect((await loadUserConnectorsProfile(USER_A)).careerHistory).toBe("");
  });

  test("a store outage is an error, never an empty profile that a save could overwrite", async () => {
    await save(USER_A, { resumeText: "precious" });
    repo.failNext.add("get");

    await expect(loadUserConnectorsProfile(USER_A)).rejects.toThrow();
  });

  test("concurrent saves re-merge instead of dropping a field", async () => {
    await save(USER_A, { careerHistory: "first" });
    // Another instance saves a different field between our read and our write.
    repo.beforeNextUpdate.push(async () => {
      await save(USER_A, { workingPreferences: "from the other instance" });
    });

    await save(USER_A, { educationAndTranscripts: "from this instance" });

    expect(await loadUserConnectorsProfile(USER_A)).toMatchObject({
      careerHistory: "first",
      workingPreferences: "from the other instance",
      educationAndTranscripts: "from this instance",
    });
  });

  test("gives up with an error after repeated conflicts", async () => {
    await save(USER_A, { careerHistory: "first" });
    // A competing writer bumps the version before each of our attempts lands.
    for (let i = 0; i < 3; i++) {
      repo.beforeNextUpdate.push(() => {
        const row = repo.rows.get(USER_A)!;

        repo.rows.set(USER_A, { ...row, version: row.version + 1 });
      });
    }

    await expect(save(USER_A, { educationAndTranscripts: "never lands" })).rejects.toThrow(
      UserConnectorsStoreError
    );
  });

  test("the Ergon status is never stored, only derived on read", async () => {
    await save(USER_A, {
      careerHistory: "kept",
      ergonConnection: {
        connected: true,
        authMode: "oauth",
        transport: "mcp",
        source: "user",
        url: "https://ergon.example.com",
        mcpUrl: "https://ergon.example.com/mcp",
        scopes: ["read", "write", "agents"],
        connectedAt: NOW,
        lastOkAt: null,
        expiresAt: null,
        hasToken: true,
        oauthReady: true,
      },
    });

    expect((await rawDocument(USER_A)).ergonConnection).toBeNull();
    expect((await loadUserConnectorsProfile(USER_A)).ergonConnection).toBeNull();
  });

  test("fields this build does not know survive a save, so profiles can evolve", async () => {
    await save(USER_A, { careerHistory: "kept" });
    // A newer deploy (or an experiment) wrote extra fields into the same document.
    const { encryptForStorage } = await import("@/lib/crypto/message-encryption");
    const document = { ...(await rawDocument(USER_A)), futureField: { mood: "curious" } };

    repo.rows.set(USER_A, {
      version: repo.rows.get(USER_A)!.version,
      payload_ciphertext: encryptForStorage(JSON.stringify(document), {
        userId: USER_A,
        threadId: "user-connectors",
        fieldName: "user_connectors.profile",
      }),
    });

    // An older instance saves an unrelated field.
    await save(USER_A, { workingPreferences: "Bun" });

    const after = await rawDocument(USER_A);

    expect(after.futureField).toEqual({ mood: "curious" });
    expect(after.workingPreferences).toBe("Bun");
    expect(after.careerHistory).toBe("kept");
  });
});

describe("connectors profile encryption policy", () => {
  test("production refuses to store a profile it cannot encrypt", async () => {
    env.NODE_ENV = "production";

    await expect(
      saveUserConnectorsProfile(
        USER_A,
        { resumeText: "private" },
        {
          encrypt: () => {
            throw new Error("Missing ORGANIC_LLM_ROOT_SECRET");
          },
        }
      )
    ).rejects.toThrow(UserConnectorsStoreError);
    expect(repo.rows.size).toBe(0);
  });

  test("production rejects a plaintext document found in the database", async () => {
    repo.rows.set(USER_A, {
      version: 1,
      payload_ciphertext: `plain:${JSON.stringify({ resumeText: "smuggled" })}`,
    });
    env.NODE_ENV = "production";

    await expect(loadUserConnectorsProfile(USER_A)).rejects.toThrow(UserConnectorsStoreError);
  });

  test("a document copied into another profile's row does not open", async () => {
    await save(USER_A, { resumeText: "alice only" });
    repo.rows.set(USER_B, { ...repo.rows.get(USER_A)! });

    await expect(loadUserConnectorsProfile(USER_B)).rejects.toThrow(UserConnectorsStoreError);
  });

  test("an unreadable stored profile is never overwritten by a save", async () => {
    repo.rows.set(USER_A, { version: 1, payload_ciphertext: "enc:v1:k1:aXY=:dGFn:Z2FyYmFnZQ==" });
    const before = repo.rows.get(USER_A)!.payload_ciphertext;

    await expect(save(USER_A, { careerHistory: "would clobber" })).rejects.toThrow();
    expect(repo.rows.get(USER_A)!.payload_ciphertext).toBe(before);
  });
});

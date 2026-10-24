import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as clerk from "@clerk/nextjs/server";

import { createMockAuth, createMockClerkUser } from "../helpers/mock-auth";
import { mockModulePreservingReal } from "../helpers/module-mock";
import * as userConnectorsStore from "@/lib/connectors/user-connectors-store";
import {
  defaultUserConnectorsProfile,
  normalizeUserConnectorsProfile,
  type UserConnectorsProfile,
  type UserConnectorsProfileInput,
} from "@/lib/schemas/user-connectors";

const mockAuth = mock(createMockAuth());
let stored: UserConnectorsProfile = defaultUserConnectorsProfile();

// Restored in afterAll: user-connectors.test.ts exercises the real store, and a stub left
// registered here made it fail on the Linux runner, where files run in a different order.
const restoreStubs = [
  mockModulePreservingReal("@clerk/nextjs/server", clerk, {
    auth: mockAuth as unknown as typeof clerk.auth,
  }),
  mockModulePreservingReal("@/lib/connectors/user-connectors-store", userConnectorsStore, {
    loadUserConnectorsProfile: async () => stored,
    saveUserConnectorsProfile: async (
      _userId: string,
      input: Partial<UserConnectorsProfileInput>
    ) => {
      stored = normalizeUserConnectorsProfile(input, stored);

      return stored;
    },
  }),
];

afterAll(() => {
  for (const restore of restoreStubs) restore();
});

import { GET, PUT } from "@/app/api/profile/connectors/route";
import { GET as getGithub } from "@/app/api/profile/connectors/github/route";

const originalFetch = globalThis.fetch;

describe("profile connectors routes", () => {
  beforeEach(() => {
    stored = defaultUserConnectorsProfile();
    mockAuth.mockReset();
    mockAuth.mockResolvedValue(createMockClerkUser());
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("GET and PUT require a signed-in user", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    expect((await GET()).status).toBe(401);
    expect(
      (
        await PUT(
          new Request("http://localhost/api/profile/connectors", {
            method: "PUT",
            body: "{}",
          })
        )
      ).status
    ).toBe(401);
    expect(
      (await getGithub(new Request("http://localhost/api/profile/connectors/github"))).status
    ).toBe(401);
  });

  test("PUT normalizes a GitHub URL and GET returns the saved dossier", async () => {
    const put = await PUT(
      new Request("http://localhost/api/profile/connectors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: "https://github.com/Alexjoshua14/",
          educationAndTranscripts: "Multivariable Calculus",
          careerHistory: "Organic LLM",
          resumeText: "CV",
          workingPreferences: "Bun",
          autoShareWithSubagents: true,
        }),
      })
    );
    const saved = (await put.json()) as { data: UserConnectorsProfile };

    expect(put.status).toBe(200);
    expect(saved.data.githubUsername).toBe("Alexjoshua14");
    expect(saved.data.githubUrl).toBe("https://github.com/Alexjoshua14");
    expect(saved.data.educationAndTranscripts).toBe("Multivariable Calculus");

    const get = await GET();
    const loaded = (await get.json()) as { data: UserConnectorsProfile };

    expect(get.status).toBe(200);
    expect(loaded.data.careerHistory).toBe("Organic LLM");
    expect(loaded.data.resumeText).toBe("CV");
  });

  test("PUT rejects an invalid payload", async () => {
    const res = await PUT(
      new Request("http://localhost/api/profile/connectors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ educationAndTranscripts: 12 }),
      })
    );

    expect(res.status).toBe(400);
    expect(stored.educationAndTranscripts).toBe("");
  });

  test("GitHub sync fetches the public profile and stores the snapshot", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/repos")) {
        return new Response(
          JSON.stringify([
            {
              name: "organic-llm",
              description: "Design lab",
              language: "TypeScript",
              html_url: "https://github.com/Alexjoshua14/organic-llm",
              updated_at: "2026-10-01T00:00:00Z",
              stargazers_count: 1,
              fork: false,
              topics: ["agents"],
            },
          ]),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          login: "Alexjoshua14",
          name: "Alex",
          bio: null,
          html_url: "https://github.com/Alexjoshua14",
          public_repos: 1,
          followers: 0,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const res = await getGithub(
      new Request(
        "http://localhost/api/profile/connectors/github?username=https%3A%2F%2Fgithub.com%2FAlexjoshua14&refresh=1"
      )
    );
    const body = (await res.json()) as {
      data: { username: string; repos: Array<{ name: string }> };
    };

    expect(res.status).toBe(200);
    expect(body.data.username).toBe("Alexjoshua14");
    expect(body.data.repos[0]?.name).toBe("organic-llm");
    expect(stored.githubUsername).toBe("Alexjoshua14");
    expect(stored.cachedGithubSnapshot?.repos[0]?.language).toBe("TypeScript");
  });

  test("GitHub sync rejects a missing handle", async () => {
    const res = await getGithub(
      new Request("http://localhost/api/profile/connectors/github?username=not%20a%20user")
    );

    expect(res.status).toBe(400);
  });
});

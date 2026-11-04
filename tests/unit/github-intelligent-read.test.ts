import { describe, expect, test } from "bun:test";

import { createGithubReadClient, GithubApiError } from "@/lib/github/read-client";
import type { GithubReadSettings } from "@/lib/github/policy";
import {
  executeGithubPullRequests,
  executeGithubReadFile,
  executeGithubRecentCommits,
  type GithubExecuteDeps,
} from "@/lib/llm/github/execute";
import { presentRepositoryText } from "@/lib/llm/github/present";
import type { GithubJevRoute } from "@/lib/llm/github/route";

const allowed: GithubReadSettings = {
  enabled: true,
  token: "test-token",
  allowAny: false,
  repos: new Set(["acme/widgets"]),
};

function deps(overrides: Partial<GithubExecuteDeps> = {}): GithubExecuteDeps {
  return {
    userId: "user-1",
    loadSettings: () => allowed,
    checkRateLimit: async () => ({ success: true }),
    createClient: () => {
      throw new Error("createClient was not stubbed");
    },
    evaluate: async () => null,
    distill: async () => {
      throw new Error("distill was not stubbed");
    },
    ...overrides,
  };
}

describe("presentRepositoryText", () => {
  test("skips Jev and the distiller for a short file", async () => {
    let evaluations = 0;
    let distillations = 0;
    const presentation = await presentRepositoryText(
      {
        question: "What is this?",
        path: "README.md",
        text: "# Hello",
        requested: "auto",
      },
      {
        evaluate: async () => {
          evaluations += 1;
          return null;
        },
        distill: async () => {
          distillations += 1;
          return "unused";
        },
      }
    );

    expect(evaluations).toBe(0);
    expect(distillations).toBe(0);
    expect(presentation.router).toBe("passthrough");
    expect(presentation.text).toContain("# Hello");
  });

  test("distills a large file with the Jev-selected model", async () => {
    const seen: string[] = [];
    const presentation = await presentRepositoryText(
      {
        question: "What does this module export?",
        path: "lib/run.ts",
        text: `export function run() {\n${"  return 1;\n".repeat(400)}`,
        requested: "auto",
      },
      {
        evaluate: async () =>
          ({
            fidelity: "summary",
            fidelityConfidence: 0.92,
            distiller: "luna",
            distillerConfidence: 0.88,
          }) satisfies GithubJevRoute,
        distill: async (request) => {
          seen.push(`${request.distiller}:${request.fidelity}`);
          return "Exports run().";
        },
      }
    );

    expect(seen).toEqual(["luna:summary"]);
    expect(presentation.text).toBe("Exports run().");
    expect(presentation.router).toBe("jev");
    expect(presentation.distiller).toBe("luna");
  });

  test("falls back to a capped slice when distillation throws", async () => {
    const presentation = await presentRepositoryText(
      {
        question: "Summarize this",
        path: "lib/run.ts",
        text: `export const value = 1;\n${"const n = 1;\n".repeat(300)}`,
        requested: "summary",
      },
      {
        evaluate: async () => null,
        distill: async () => {
          throw new Error("gateway down");
        },
      }
    );

    expect(presentation.router).toBe("distill_failed");
    expect(presentation.fidelity).toBe("raw");
    expect(presentation.text.length).toBeGreaterThan(0);
    expect(presentation.truncated).toBe(true);
  });
});

describe("executeGithubReadFile", () => {
  test("does not call GitHub when the repo is outside the allowlist", async () => {
    let created = 0;
    const result = await executeGithubReadFile(
      { owner: "acme", repo: "other", path: "README.md" },
      deps({
        createClient: () => {
          created += 1;
          throw new Error("should not create a client");
        },
      })
    );

    expect(created).toBe(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowlisted");
  });

  test("rejects path traversal before any request", async () => {
    const result = await executeGithubReadFile(
      { owner: "acme", repo: "widgets", path: "../secrets.env" },
      deps()
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_input");
  });

  test("returns a directory listing without distillation", async () => {
    let distilled = 0;
    const result = await executeGithubReadFile(
      { owner: "acme", repo: "widgets", path: "lib" },
      deps({
        createClient: () =>
          createGithubReadClient({
            token: "test-token",
            fetchImpl: async () =>
              new Response(
                JSON.stringify([
                  { path: "lib/a.ts", type: "file", size: 10 },
                  { path: "lib/b.ts", type: "file", size: 12 },
                ]),
                { status: 200, headers: { "content-type": "application/json" } }
              ),
          }),
        distill: async () => {
          distilled += 1;
          return "nope";
        },
      })
    );

    expect(distilled).toBe(0);
    expect(result.ok).toBe(true);
    if (!result.ok || result.kind !== "github_directory") {
      throw new Error("expected a directory");
    }
    expect(result.entries).toHaveLength(2);
  });
});

describe("executeGithubRecentCommits", () => {
  test("keeps subjects and distills a long log", async () => {
    const result = await executeGithubRecentCommits(
      { owner: "acme", repo: "widgets", question: "What shipped?", fidelity: "summary" },
      deps({
        createClient: () =>
          createGithubReadClient({
            token: "test-token",
            fetchImpl: async () =>
              new Response(
                JSON.stringify([
                  {
                    sha: "abc123def456",
                    html_url: "https://github.com/acme/widgets/commit/abc123def456",
                    commit: {
                      message: `Add reader\n${"detail line\n".repeat(200)}`,
                      author: { name: "Ada", date: "2026-10-02T00:00:00Z" },
                    },
                  },
                ]),
                { status: 200 }
              ),
          }),
        evaluate: async () => null,
        distill: async () => "Shipped a reader.",
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.kind !== "github_commits") throw new Error("expected commits");
    expect(result.commits[0]?.subject).toBe("Add reader");
    expect(result.text).toBe("Shipped a reader.");
    expect(result.distiller).toBe("haiku");
  });
});

describe("executeGithubPullRequests", () => {
  test("surfaces a GitHub error without throwing", async () => {
    const result = await executeGithubPullRequests(
      { owner: "acme", repo: "widgets", number: 4 },
      deps({
        createClient: () =>
          createGithubReadClient({
            token: "test-token",
            fetchImpl: async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
          }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("github_error");
    expect(result.error).toBe("Not Found");
  });
});

describe("createGithubReadClient", () => {
  test("decodes file contents and sends the bearer token", async () => {
    const content = Buffer.from("export const answer = 42;\n", "utf8").toString("base64");
    let authorization: string | null = null;
    const client = createGithubReadClient({
      token: "test-token",
      fetchImpl: async (_input, init) => {
        authorization = new Headers(init?.headers).get("authorization");
        return new Response(
          JSON.stringify({
            type: "file",
            path: "src/answer.ts",
            html_url: "https://github.com/acme/widgets/blob/main/src/answer.ts",
            size: 26,
            content,
          }),
          { status: 200 }
        );
      },
    });

    const file = await client.contents("acme", "widgets", "src/answer.ts", "main");

    expect(authorization).toBe("Bearer test-token");
    expect(file.kind).toBe("file");
    if (file.kind !== "file") return;
    expect(file.text).toBe("export const answer = 42;\n");
  });

  test("throws GithubApiError on a non-OK response", async () => {
    const client = createGithubReadClient({
      token: null,
      fetchImpl: async () => new Response(JSON.stringify({ message: "rate limit exceeded" }), { status: 403 }),
    });

    await expect(client.repo("acme", "widgets")).rejects.toBeInstanceOf(GithubApiError);
  });
});

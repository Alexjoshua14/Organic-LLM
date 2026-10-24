import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { createGithubReadClient } from "@/lib/github/read-client";
import { loadGithubReadSettings, type GithubFidelityRequest } from "@/lib/github/policy";
import { checkExternalFetchLimit } from "@/lib/rate-limit/external-fetch";
import { distillRepositoryText } from "@/lib/llm/github/distill";
import {
  executeGithubPullRequests,
  executeGithubReadFile,
  executeGithubRecentCommits,
  executeGithubRepoOverview,
  type GithubExecuteDeps,
} from "@/lib/llm/github/execute";
import { evaluateGithubRoute } from "@/lib/llm/github/jev";

const FidelitySchema = z
  .enum(["auto", "summary", "excerpts", "raw"])
  .optional()
  .describe(
    "auto lets a smaller model choose. summary is a brief. excerpts are short code blocks. raw is a capped source slice."
  );

const RepoSchema = {
  owner: z.string().min(1).describe("GitHub repository owner"),
  repo: z.string().min(1).describe("GitHub repository name"),
};

function defaultDeps(userId: string, overrides?: Partial<GithubExecuteDeps>): GithubExecuteDeps {
  return {
    userId,
    loadSettings: loadGithubReadSettings,
    checkRateLimit: async (id) => checkExternalFetchLimit(id),
    createClient: (token) => createGithubReadClient({ token }),
    evaluate: (state) => evaluateGithubRoute(state),
    distill: (request) => distillRepositoryText(request),
    ...overrides,
  };
}

export function createGithubReadTools(options: {
  sbUserId: string;
  deps?: Partial<GithubExecuteDeps>;
}): ToolSet {
  const deps = defaultDeps(options.sbUserId, options.deps);

  return {
    github_repo_overview: tool({
      description:
        "Read an allowlisted GitHub repository: description, default branch, and root file listing. Read-only.",
      inputSchema: z.object({
        ...RepoSchema,
        ref: z
          .string()
          .optional()
          .describe("Branch, tag, or commit. Defaults to the default branch."),
      }),
      execute: async (input) => executeGithubRepoOverview(input, deps),
    }),
    github_recent_commits: tool({
      description:
        "Read recent commits on an allowlisted GitHub repository. Large logs are distilled by a smaller zero-data-retention model before they reach you. Read-only.",
      inputSchema: z.object({
        ...RepoSchema,
        ref: z.string().optional().describe("Branch, tag, or commit SHA."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(15)
          .optional()
          .describe("How many commits to read. Default 10."),
        question: z
          .string()
          .optional()
          .describe("What the user wants to know about these commits."),
        fidelity: FidelitySchema,
      }),
      execute: async (input) =>
        executeGithubRecentCommits(
          { ...input, fidelity: input.fidelity as GithubFidelityRequest | undefined },
          deps
        ),
    }),
    github_pull_requests: tool({
      description:
        "List pull requests, or read one pull request and its changed files, on an allowlisted GitHub repository. Detail views are distilled unless fidelity is raw. Read-only.",
      inputSchema: z.object({
        ...RepoSchema,
        state: z
          .enum(["open", "closed", "all"])
          .optional()
          .describe("List filter. Default open. Ignored when number is set."),
        number: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Pull request number. Omit to list."),
        limit: z.number().int().min(1).max(10).optional().describe("List size. Default 8."),
        question: z
          .string()
          .optional()
          .describe("What the user wants to know. Required in spirit for a useful distillation."),
        fidelity: FidelitySchema,
      }),
      execute: async (input) =>
        executeGithubPullRequests(
          { ...input, fidelity: input.fidelity as GithubFidelityRequest | undefined },
          deps
        ),
    }),
    github_read_file: tool({
      description:
        "Read a file or directory in an allowlisted GitHub repository. auto/summary/excerpts distill through a smaller zero-data-retention model (Luna, Terra, Haiku, or Kimi). raw returns a capped source slice. Read-only.",
      inputSchema: z.object({
        ...RepoSchema,
        path: z.string().min(1).describe("Repository-relative path, such as lib/github/policy.ts"),
        ref: z
          .string()
          .optional()
          .describe("Branch, tag, or commit. Defaults to the default branch."),
        question: z
          .string()
          .optional()
          .describe("The user's question, used to steer distillation."),
        fidelity: FidelitySchema,
      }),
      execute: async (input) =>
        executeGithubReadFile(
          { ...input, fidelity: input.fidelity as GithubFidelityRequest | undefined },
          deps
        ),
    }),
  };
}

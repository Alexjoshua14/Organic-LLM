import { createLogger } from "@/lib/logger";
import { GithubApiError, type GithubReadClient } from "@/lib/github/read-client";
import {
  GITHUB_LIST_CAPS,
  GITHUB_UNTRUSTED_NOTE,
  githubRepoAllowed,
  parseGithubName,
  parseGithubPath,
  parseGithubRef,
  type GithubFidelityRequest,
  type GithubReadSettings,
} from "@/lib/github/policy";
import { sanitizeUntrustedText } from "@/lib/security/external-content/untrusted";
import {
  presentRepositoryText,
  type GithubPresentation,
  type PresentRepositoryDeps,
} from "@/lib/llm/github/present";

const logger = createLogger("lib/llm/github/execute.ts");

export type GithubToolFailure = {
  ok: false;
  code: "not_configured" | "not_allowlisted" | "rate_limited" | "invalid_input" | "github_error";
  error: string;
};

export type GithubExecuteDeps = PresentRepositoryDeps & {
  userId: string;
  loadSettings: () => GithubReadSettings;
  checkRateLimit: (userId: string) => Promise<{ success: boolean; error?: string }>;
  createClient: (token: string | null) => GithubReadClient;
};

const NOTE = GITHUB_UNTRUSTED_NOTE;

function failure(error: unknown): GithubToolFailure {
  if (error instanceof GithubApiError) {
    return { ok: false, code: "github_error", error: error.message };
  }

  const message = error instanceof Error ? error.message : "GitHub read failed";

  return { ok: false, code: "github_error", error: message.slice(0, 300) };
}

async function openClient(
  deps: GithubExecuteDeps,
  ownerRaw: string,
  repoRaw: string
): Promise<{ client: GithubReadClient; owner: string; repo: string } | GithubToolFailure> {
  const owner = parseGithubName(ownerRaw);
  const repo = parseGithubName(repoRaw);

  if (!owner || !repo) {
    return {
      ok: false,
      code: "invalid_input",
      error: "owner and repo must be GitHub name segments.",
    };
  }

  const settings = deps.loadSettings();

  if (!settings.enabled) {
    return { ok: false, code: settings.code, error: settings.error };
  }

  if (!githubRepoAllowed(settings, owner, repo)) {
    return {
      ok: false,
      code: "not_allowlisted",
      error: `${owner}/${repo} is not in GITHUB_READ_ALLOWLIST.`,
    };
  }

  const limit = await deps.checkRateLimit(deps.userId);

  if (!limit.success) {
    return {
      ok: false,
      code: "rate_limited",
      error: limit.error ?? "Too many GitHub reads.",
    };
  }

  return { client: deps.createClient(settings.token), owner, repo };
}

function refOrFailure(ref: string | undefined): string | undefined | GithubToolFailure {
  const parsed = parseGithubRef(ref);

  if (parsed === null) {
    return { ok: false, code: "invalid_input", error: "ref contains unsupported characters." };
  }

  return parsed;
}

function isFailure(value: unknown): value is GithubToolFailure {
  return Boolean(
    value && typeof value === "object" && "ok" in value && (value as { ok: boolean }).ok === false
  );
}

export async function executeGithubRepoOverview(
  input: { owner: string; repo: string; ref?: string },
  deps: GithubExecuteDeps
) {
  const opened = await openClient(deps, input.owner, input.repo);

  if (isFailure(opened)) return opened;

  const ref = refOrFailure(input.ref);

  if (isFailure(ref)) return ref;

  try {
    const repo = await opened.client.repo(opened.owner, opened.repo);
    const entries = await opened.client.rootEntries(
      opened.owner,
      opened.repo,
      ref ?? repo.defaultBranch
    );
    const capped = entries.slice(0, GITHUB_LIST_CAPS.directoryEntries);

    logger.log("overview", "read repository", {
      event: "github_overview",
      repo: repo.fullName,
    });

    return {
      ok: true as const,
      kind: "github_repo_overview" as const,
      repo: repo.fullName,
      description: repo.description ? sanitizeUntrustedText(repo.description, 500) : null,
      defaultBranch: repo.defaultBranch,
      private: repo.private,
      htmlUrl: repo.htmlUrl,
      language: repo.language,
      pushedAt: repo.pushedAt,
      ref: ref ?? repo.defaultBranch,
      entries: capped.map((entry) => ({
        path: entry.path,
        type: entry.type,
        size: entry.size,
      })),
      truncated: entries.length > capped.length,
      note: NOTE,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function executeGithubRecentCommits(
  input: {
    owner: string;
    repo: string;
    ref?: string;
    limit?: number;
    question?: string;
    fidelity?: GithubFidelityRequest;
  },
  deps: GithubExecuteDeps
) {
  const opened = await openClient(deps, input.owner, input.repo);

  if (isFailure(opened)) return opened;

  const ref = refOrFailure(input.ref);

  if (isFailure(ref)) return ref;

  const limit = Math.min(Math.max(input.limit ?? 10, 1), GITHUB_LIST_CAPS.commits);

  try {
    const commits = await opened.client.commits(opened.owner, opened.repo, ref, limit);
    const blob = commits
      .map((commit) => `${commit.sha.slice(0, 7)} ${commit.subject}\n${commit.body}`)
      .join("\n\n");
    const question = input.question?.trim() || "What landed in these commits?";
    const presentation = await presentRepositoryText(
      {
        question,
        path: "commits",
        text: blob,
        requested: input.fidelity ?? "auto",
      },
      deps
    );

    logger.log("commits", "read commits", {
      event: "github_commits",
      repo: `${opened.owner}/${opened.repo}`,
      count: commits.length,
      router: presentation.router,
    });

    return {
      ok: true as const,
      kind: "github_commits" as const,
      repo: `${opened.owner}/${opened.repo}`,
      ref: ref ?? null,
      commits: commits.map((commit) => ({
        sha: commit.sha,
        url: commit.url,
        date: commit.date,
        author: commit.author,
        subject: sanitizeUntrustedText(commit.subject, 200),
      })),
      ...publicPresentation(presentation),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function executeGithubPullRequests(
  input: {
    owner: string;
    repo: string;
    state?: "open" | "closed" | "all";
    number?: number;
    limit?: number;
    question?: string;
    fidelity?: GithubFidelityRequest;
  },
  deps: GithubExecuteDeps
) {
  const opened = await openClient(deps, input.owner, input.repo);

  if (isFailure(opened)) return opened;

  try {
    if (input.number !== undefined) {
      if (!Number.isInteger(input.number) || input.number < 1) {
        return {
          ok: false,
          code: "invalid_input",
          error: "Pull request number must be a positive integer.",
        };
      }

      const pull = await opened.client.pull(opened.owner, opened.repo, input.number);
      const files = await opened.client.pullFiles(opened.owner, opened.repo, input.number);
      const blob = [
        `#${pull.number} ${pull.title}`,
        pull.body,
        ...files.map(
          (file) =>
            `## ${file.filename} (${file.status}) +${file.additions} -${file.deletions}\n${file.patch ?? "(no patch)"}`
        ),
      ].join("\n\n");
      const presentation = await presentRepositoryText(
        {
          question: input.question?.trim() || "What does this pull request change?",
          path: `pull/${pull.number}`,
          text: blob,
          requested: input.fidelity ?? "auto",
        },
        deps
      );

      logger.log("pull", "read pull request", {
        event: "github_pull",
        repo: `${opened.owner}/${opened.repo}`,
        number: pull.number,
        router: presentation.router,
      });

      return {
        ok: true as const,
        kind: "github_pull" as const,
        repo: `${opened.owner}/${opened.repo}`,
        number: pull.number,
        title: sanitizeUntrustedText(pull.title, 300),
        state: pull.state,
        draft: pull.draft,
        author: pull.author,
        url: pull.url,
        files: files.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
        })),
        ...publicPresentation(presentation),
      };
    }

    const limit = Math.min(Math.max(input.limit ?? 8, 1), GITHUB_LIST_CAPS.pulls);
    const pulls = await opened.client.pulls(
      opened.owner,
      opened.repo,
      input.state ?? "open",
      limit
    );
    const listText = pulls
      .map((pull) => `#${pull.number} [${pull.state}] ${pull.title}\n${pull.body.slice(0, 400)}`)
      .join("\n\n");
    const presentation =
      input.question && input.question.trim().length > 0
        ? await presentRepositoryText(
            {
              question: input.question,
              path: "pulls",
              text: listText,
              requested: input.fidelity ?? "summary",
            },
            deps
          )
        : null;

    logger.log("pulls", "listed pull requests", {
      event: "github_pulls",
      repo: `${opened.owner}/${opened.repo}`,
      count: pulls.length,
    });

    return {
      ok: true as const,
      kind: "github_pulls" as const,
      repo: `${opened.owner}/${opened.repo}`,
      state: input.state ?? "open",
      pulls: pulls.map((pull) => ({
        number: pull.number,
        title: sanitizeUntrustedText(pull.title, 300),
        state: pull.state,
        draft: pull.draft,
        author: pull.author,
        url: pull.url,
        updatedAt: pull.updatedAt,
      })),
      ...(presentation ? publicPresentation(presentation) : { note: NOTE }),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function executeGithubReadFile(
  input: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
    question?: string;
    fidelity?: GithubFidelityRequest;
  },
  deps: GithubExecuteDeps
) {
  const path = parseGithubPath(input.path);

  if (!path) {
    return {
      ok: false,
      code: "invalid_input",
      error: "path must be a repository-relative file path.",
    };
  }

  const ref = refOrFailure(input.ref);

  if (isFailure(ref)) return ref;

  const opened = await openClient(deps, input.owner, input.repo);

  if (isFailure(opened)) return opened;

  try {
    const contents = await opened.client.contents(opened.owner, opened.repo, path, ref);

    if (contents.kind === "directory") {
      return {
        ok: true as const,
        kind: "github_directory" as const,
        repo: `${opened.owner}/${opened.repo}`,
        path: contents.path,
        ref: ref ?? null,
        entries: contents.entries,
        truncated: contents.truncated,
        note: NOTE,
      };
    }

    const presentation = await presentRepositoryText(
      {
        question: input.question?.trim() || "What does this file do?",
        path: contents.path,
        text: contents.text,
        requested: input.fidelity ?? "auto",
      },
      deps
    );

    logger.log("file", "read file", {
      event: "github_file",
      repo: `${opened.owner}/${opened.repo}`,
      path: contents.path,
      router: presentation.router,
      fidelity: presentation.fidelity,
    });

    return {
      ok: true as const,
      kind: "github_file" as const,
      repo: `${opened.owner}/${opened.repo}`,
      path: contents.path,
      ref: ref ?? null,
      htmlUrl: contents.htmlUrl,
      size: contents.size,
      ...publicPresentation(presentation),
    };
  } catch (error) {
    return failure(error);
  }
}

function publicPresentation(presentation: GithubPresentation) {
  return {
    fidelity: presentation.fidelity,
    distiller: presentation.distiller,
    router: presentation.router,
    truncated: presentation.truncated,
    text: presentation.text,
    note: presentation.note,
  };
}

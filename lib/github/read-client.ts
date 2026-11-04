import { GITHUB_API_ROOT, GITHUB_LIST_CAPS, parseGithubPath } from "@/lib/github/policy";

export class GithubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
  }
}

export type GithubRepoMeta = {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  language: string | null;
  pushedAt: string | null;
};

export type GithubTreeEntry = {
  path: string;
  type: string;
  size: number | null;
};

export type GithubCommitRecord = {
  sha: string;
  url: string;
  date: string | null;
  author: string | null;
  subject: string;
  body: string;
};

export type GithubPullRecord = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  author: string | null;
  url: string;
  updatedAt: string | null;
  body: string;
};

export type GithubPullFileRecord = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
};

export type GithubFileRecord = {
  kind: "file";
  path: string;
  htmlUrl: string | null;
  size: number;
  text: string;
  truncated: boolean;
};

export type GithubDirectoryRecord = {
  kind: "directory";
  path: string;
  entries: GithubTreeEntry[];
  truncated: boolean;
};

export type GithubReadClient = {
  repo(owner: string, repo: string): Promise<GithubRepoMeta>;
  rootEntries(owner: string, repo: string, ref: string | undefined): Promise<GithubTreeEntry[]>;
  commits(
    owner: string,
    repo: string,
    ref: string | undefined,
    limit: number
  ): Promise<GithubCommitRecord[]>;
  pulls(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all",
    limit: number
  ): Promise<GithubPullRecord[]>;
  pull(owner: string, repo: string, number: number): Promise<GithubPullRecord>;
  pullFiles(owner: string, repo: string, number: number): Promise<GithubPullFileRecord[]>;
  contents(
    owner: string,
    repo: string,
    path: string,
    ref: string | undefined
  ): Promise<GithubFileRecord | GithubDirectoryRecord>;
};

type FetchLike = typeof fetch;

function githubHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "organic-llm-arcadia",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

async function githubJson(
  fetchImpl: FetchLike,
  token: string | null,
  path: string
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetchImpl(`${GITHUB_API_ROOT}${path}`, {
      headers: githubHeaders(token),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub request failed";

    throw new GithubApiError(0, message.slice(0, 300));
  }

  const raw = await response.text();

  if (!response.ok) {
    let message = `GitHub API returned ${response.status}`;

    try {
      const body = JSON.parse(raw) as { message?: unknown };

      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message.trim().slice(0, 300);
      }
    } catch {
      /* Non-JSON error bodies stay on the status fallback. */
    }

    throw new GithubApiError(response.status, message);
  }

  if (!raw) return null;

  return JSON.parse(raw) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function entryFromContents(value: unknown): GithubTreeEntry | null {
  const record = asRecord(value);

  if (!record || typeof record.path !== "string" || typeof record.type !== "string") return null;

  return {
    path: record.path,
    type: record.type,
    size: typeof record.size === "number" ? record.size : null,
  };
}

function commitFromApi(value: unknown): GithubCommitRecord | null {
  const record = asRecord(value);
  const commit = asRecord(record?.commit);
  const author = asRecord(commit?.author);

  if (!record || typeof record.sha !== "string" || !commit) return null;

  const message = typeof commit.message === "string" ? commit.message : "";
  const [subject, ...rest] = message.split("\n");

  return {
    sha: record.sha,
    url: stringOrNull(record.html_url) ?? "",
    date: stringOrNull(author?.date),
    author: stringOrNull(author?.name),
    subject: (subject ?? "").trim(),
    body: rest.join("\n").trim(),
  };
}

function pullFromApi(value: unknown): GithubPullRecord | null {
  const record = asRecord(value);
  const user = asRecord(record?.user);

  if (!record || typeof record.number !== "number" || typeof record.title !== "string") return null;

  return {
    number: record.number,
    title: record.title,
    state: stringOrNull(record.state) ?? "unknown",
    draft: record.draft === true,
    author: stringOrNull(user?.login),
    url: stringOrNull(record.html_url) ?? "",
    updatedAt: stringOrNull(record.updated_at),
    body: typeof record.body === "string" ? record.body : "",
  };
}

function decodeBase64(content: string): string {
  return Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
}

export function createGithubReadClient(options: {
  token: string | null;
  fetchImpl?: FetchLike;
}): GithubReadClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = options.token;

  return {
    async repo(owner, repo) {
      const body = asRecord(await githubJson(fetchImpl, token, `/repos/${owner}/${repo}`));

      if (!body || typeof body.full_name !== "string") {
        throw new GithubApiError(502, "GitHub repository payload was missing full_name.");
      }

      return {
        fullName: body.full_name,
        description: stringOrNull(body.description),
        defaultBranch: stringOrNull(body.default_branch) ?? "main",
        private: body.private === true,
        htmlUrl: stringOrNull(body.html_url) ?? "",
        language: stringOrNull(body.language),
        pushedAt: stringOrNull(body.pushed_at),
      };
    },

    async rootEntries(owner, repo, ref) {
      const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const body = await githubJson(fetchImpl, token, `/repos/${owner}/${repo}/contents${query}`);

      if (!Array.isArray(body)) {
        throw new GithubApiError(502, "GitHub root listing was not a directory.");
      }

      return body.flatMap((entry) => {
        const parsed = entryFromContents(entry);

        return parsed ? [parsed] : [];
      });
    },

    async commits(owner, repo, ref, limit) {
      const perPage = Math.min(Math.max(limit, 1), GITHUB_LIST_CAPS.commits);
      const params = new URLSearchParams({ per_page: String(perPage) });

      if (ref) params.set("sha", ref);
      const body = await githubJson(
        fetchImpl,
        token,
        `/repos/${owner}/${repo}/commits?${params.toString()}`
      );

      if (!Array.isArray(body)) return [];

      return body.flatMap((entry) => {
        const parsed = commitFromApi(entry);

        return parsed ? [parsed] : [];
      });
    },

    async pulls(owner, repo, state, limit) {
      const perPage = Math.min(Math.max(limit, 1), GITHUB_LIST_CAPS.pulls);
      const params = new URLSearchParams({
        state,
        per_page: String(perPage),
        sort: "updated",
        direction: "desc",
      });
      const body = await githubJson(
        fetchImpl,
        token,
        `/repos/${owner}/${repo}/pulls?${params.toString()}`
      );

      if (!Array.isArray(body)) return [];

      return body.flatMap((entry) => {
        const parsed = pullFromApi(entry);

        return parsed ? [parsed] : [];
      });
    },

    async pull(owner, repo, number) {
      const parsed = pullFromApi(
        await githubJson(fetchImpl, token, `/repos/${owner}/${repo}/pulls/${number}`)
      );

      if (!parsed) throw new GithubApiError(502, "GitHub pull request payload was incomplete.");

      return parsed;
    },

    async pullFiles(owner, repo, number) {
      const params = new URLSearchParams({
        per_page: String(GITHUB_LIST_CAPS.pullFiles),
      });
      const body = await githubJson(
        fetchImpl,
        token,
        `/repos/${owner}/${repo}/pulls/${number}/files?${params.toString()}`
      );

      if (!Array.isArray(body)) return [];

      return body.flatMap((entry) => {
        const record = asRecord(entry);

        if (!record || typeof record.filename !== "string") return [];

        return [
          {
            filename: record.filename,
            status: stringOrNull(record.status) ?? "unknown",
            additions: numberOrZero(record.additions),
            deletions: numberOrZero(record.deletions),
            patch: typeof record.patch === "string" ? record.patch : null,
          },
        ];
      });
    },

    async contents(owner, repo, path, ref) {
      const safePath = parseGithubPath(path);

      if (!safePath) throw new GithubApiError(400, "Invalid repository path.");

      const encoded = safePath.split("/").map(encodeURIComponent).join("/");
      const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const body = await githubJson(
        fetchImpl,
        token,
        `/repos/${owner}/${repo}/contents/${encoded}${query}`
      );

      if (Array.isArray(body)) {
        const entries = body.flatMap((entry) => {
          const parsed = entryFromContents(entry);

          return parsed ? [parsed] : [];
        });
        const truncated = entries.length > GITHUB_LIST_CAPS.directoryEntries;

        return {
          kind: "directory",
          path: safePath,
          entries: entries.slice(0, GITHUB_LIST_CAPS.directoryEntries),
          truncated,
        };
      }

      const record = asRecord(body);

      if (!record || record.type === "symlink" || record.type === "submodule") {
        throw new GithubApiError(422, "That path is not a regular file or directory.");
      }

      if (typeof record.content !== "string") {
        throw new GithubApiError(
          422,
          "GitHub did not include file contents. The file may be binary or over 1MB."
        );
      }

      const text = decodeBase64(record.content);

      if (text.includes("\u0000")) {
        throw new GithubApiError(422, "Binary files are not read by this tool.");
      }

      return {
        kind: "file",
        path: typeof record.path === "string" ? record.path : safePath,
        htmlUrl: stringOrNull(record.html_url),
        size: numberOrZero(record.size),
        text,
        truncated: false,
      };
    },
  };
}

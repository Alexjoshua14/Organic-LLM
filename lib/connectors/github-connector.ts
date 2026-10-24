import {
  formatGithubConnectorForWorktable,
  GithubConnectorSnapshotSchema,
  GithubProfileSummarySchema,
  GithubRepoSummarySchema,
  normalizeGithubProfileUrl,
  normalizeGithubUsername,
  type GithubConnectorSnapshot,
  type GithubProfileSummary,
  type GithubRepoSummary,
} from "@/lib/schemas/user-connectors";

export {
  formatGithubConnectorForWorktable,
  normalizeGithubProfileUrl,
  normalizeGithubUsername,
  type GithubConnectorSnapshot,
  type GithubProfileSummary,
  type GithubRepoSummary,
};

const GITHUB_API_ORIGIN = "https://api.github.com";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_REPOS = 15;

type CacheEntry = {
  snapshot: GithubConnectorSnapshot;
  expiresAt: number;
};

const snapshotCache = new Map<string, CacheEntry>();

export type FetchGithubSnapshotOptions = {
  maxRepos?: number;
  forceRefresh?: boolean;
  cacheTtlMs?: number;
  githubToken?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type FetchGithubSnapshotResult =
  | { ok: true; snapshot: GithubConnectorSnapshot; cached: boolean }
  | { ok: false; error: string; status?: number };

function buildGithubHeaders(token?: string): Record<string, string> {
  const resolvedToken = (token ?? process.env.GITHUB_TOKEN ?? "").trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Organic-LLM-Connectors/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  return headers;
}

function coerceRepo(raw: Record<string, unknown>, fallbackOwner: string): GithubRepoSummary | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";

  if (!name) return null;
  const htmlUrl =
    typeof raw.html_url === "string" && raw.html_url.startsWith("https://github.com/")
      ? raw.html_url
      : `https://github.com/${fallbackOwner}/${name}`;

  const parsed = GithubRepoSummarySchema.safeParse({
    name,
    full_name: typeof raw.full_name === "string" ? raw.full_name : `${fallbackOwner}/${name}`,
    description: typeof raw.description === "string" ? raw.description.slice(0, 2_000) : null,
    language: typeof raw.language === "string" ? raw.language : null,
    html_url: htmlUrl,
    updated_at:
      typeof raw.updated_at === "string"
        ? raw.updated_at
        : typeof raw.pushed_at === "string"
          ? raw.pushed_at
          : null,
    stargazers_count: typeof raw.stargazers_count === "number" ? raw.stargazers_count : 0,
    fork: Boolean(raw.fork),
    topics: Array.isArray(raw.topics)
      ? raw.topics.filter((t): t is string => typeof t === "string").slice(0, 20)
      : [],
  });

  return parsed.success ? parsed.data : null;
}

function coerceProfile(
  raw: Record<string, unknown>,
  fallbackUsername: string
): GithubProfileSummary | null {
  const login =
    typeof raw.login === "string" && raw.login.trim() ? raw.login.trim() : fallbackUsername;
  const htmlUrl =
    typeof raw.html_url === "string" && raw.html_url.startsWith("https://github.com/")
      ? raw.html_url
      : `https://github.com/${login}`;

  const parsed = GithubProfileSummarySchema.safeParse({
    login,
    name: typeof raw.name === "string" ? raw.name : null,
    bio: typeof raw.bio === "string" ? raw.bio : null,
    html_url: htmlUrl,
    public_repos: typeof raw.public_repos === "number" ? raw.public_repos : 0,
    followers: typeof raw.followers === "number" ? raw.followers : 0,
    company: typeof raw.company === "string" ? raw.company : null,
    location: typeof raw.location === "string" ? raw.location : null,
    blog: typeof raw.blog === "string" ? raw.blog : null,
  });

  return parsed.success ? parsed.data : null;
}

export function getCachedGithubSnapshot(
  rawHandleOrUrl: string,
  now: () => number = Date.now
): GithubConnectorSnapshot | null {
  const username = normalizeGithubUsername(rawHandleOrUrl);

  if (!username) return null;
  const key = username.toLowerCase();
  const entry = snapshotCache.get(key);

  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    snapshotCache.delete(key);

    return null;
  }

  return entry.snapshot;
}

export function clearGithubSnapshotCache(): void {
  snapshotCache.clear();
}

/**
 * SSRF-safe GitHub public profile + repository inspector.
 * Strictly validates `rawHandleOrUrl` to a canonical GitHub username and only issues HTTPS GETs
 * to `https://api.github.com/users/<username>`.
 */
export async function fetchGithubConnectorSnapshot(
  rawHandleOrUrl: string,
  options: FetchGithubSnapshotOptions = {}
): Promise<FetchGithubSnapshotResult> {
  const username = normalizeGithubUsername(rawHandleOrUrl);

  if (!username) {
    return {
      ok: false,
      error:
        "Invalid GitHub username or profile URL. Expected a handle like Alexjoshua14 or https://github.com/Alexjoshua14.",
      status: 400,
    };
  }

  const now = options.now ?? Date.now;
  const cacheKey = username.toLowerCase();

  if (!options.forceRefresh) {
    const cached = getCachedGithubSnapshot(username, now);

    if (cached) {
      return { ok: true, snapshot: cached, cached: true };
    }
  }

  const maxRepos = Math.min(30, Math.max(1, options.maxRepos ?? DEFAULT_MAX_REPOS));
  const encodedUser = encodeURIComponent(username);
  const userUrl = `${GITHUB_API_ORIGIN}/users/${encodedUser}`;
  const reposUrl = `${GITHUB_API_ORIGIN}/users/${encodedUser}/repos?sort=updated&direction=desc&per_page=${maxRepos}&type=owner`;
  const headers = buildGithubHeaders(options.githubToken);
  const doFetch = options.fetchImpl ?? fetch;

  try {
    const [userRes, reposRes] = await Promise.all([
      doFetch(userUrl, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }),
      doFetch(reposUrl, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }),
    ]);

    if (userRes.status === 404) {
      return {
        ok: false,
        error: `GitHub user "@${username}" was not found.`,
        status: 404,
      };
    }

    if (!userRes.ok) {
      return {
        ok: false,
        error: `GitHub API returned HTTP ${userRes.status} while fetching @${username}.`,
        status: userRes.status,
      };
    }

    const userJson = (await userRes.json().catch(() => ({}))) as Record<string, unknown>;
    const reposJson = reposRes.ok ? ((await reposRes.json().catch(() => [])) as unknown) : [];

    const profile = coerceProfile(userJson, username);
    const resolvedUsername = profile?.login ?? username;
    const repos: GithubRepoSummary[] = Array.isArray(reposJson)
      ? reposJson
          .map((item) =>
            item && typeof item === "object"
              ? coerceRepo(item as Record<string, unknown>, resolvedUsername)
              : null
          )
          .filter((r): r is GithubRepoSummary => r !== null)
          .slice(0, maxRepos)
      : [];

    const snapshot = GithubConnectorSnapshotSchema.parse({
      username: resolvedUsername,
      profileUrl: profile?.html_url ?? `https://github.com/${resolvedUsername}`,
      fetchedAt: new Date(now()).toISOString(),
      profile,
      repos,
    });

    snapshotCache.set(cacheKey, {
      snapshot,
      expiresAt: now() + (options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS),
    });

    return { ok: true, snapshot, cached: false };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Failed to reach GitHub API: ${error.message}`
          : "Failed to reach GitHub API.",
      status: 502,
    };
  }
}

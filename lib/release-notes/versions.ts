import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { APP_VERSION } from "@/lib/app-version";

const execFileAsync = promisify(execFile);

/** Prefer the build-injected app version; fall back to package.json on disk. */
export function resolveCurrentAppVersion(injected: string = APP_VERSION): string {
  if (injected && injected !== "0.0.0") return injected;

  try {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const version = parsePackageVersion(raw);

    if (version) return version;
  } catch {
    // keep injected
  }

  return injected || "0.0.0";
}

export type ResolvedVersion = {
  /** Semver string without leading v, e.g. "0.14.1" */
  version: string;
  /** Commit SHA where package.json first carried this version (newest bump for that version). */
  sha: string;
};

export type VersionCatalog = {
  /** Newest first. */
  versions: ResolvedVersion[];
  currentVersion: string;
  /** SHA of the commit that introduced currentVersion, or null if unresolved. */
  currentSha: string | null;
  /** Version immediately before current, if any. */
  previousVersion: string | null;
  previousSha: string | null;
};

type GitRunner = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

async function defaultGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, {
    cwd: process.cwd(),
    maxBuffer: 8 * 1024 * 1024,
    encoding: "utf8",
  });
}

function parsePackageVersion(jsonText: string): string | null {
  try {
    const parsed = JSON.parse(jsonText) as { version?: unknown };

    return typeof parsed.version === "string" && parsed.version.trim()
      ? parsed.version.trim()
      : null;
  } catch {
    return null;
  }
}

function compareSemverDesc(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;

    if (da !== db) return db - da;
  }

  return 0;
}

/**
 * Discover app versions from package.json history (and annotated/lightweight tags).
 * Returns unique versions newest-first, each pinned to the commit that introduced that version string.
 */
export async function discoverAppVersions(
  git: GitRunner = defaultGit
): Promise<ResolvedVersion[]> {
  const byVersion = new Map<string, string>();

  try {
    const { stdout } = await git([
      "log",
      "-G",
      '"version":',
      "--pretty=format:%H",
      "--",
      "package.json",
    ]);
    const shas = stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sha of shas) {
      try {
        const show = await git(["show", `${sha}:package.json`]);
        const version = parsePackageVersion(show.stdout);

        if (!version) continue;
        // First occurrence while walking newest→oldest wins (introducing commit for that version).
        if (!byVersion.has(version)) {
          byVersion.set(version, sha);
        }
      } catch {
        // Skip missing/corrupt blobs.
      }
    }
  } catch {
    // Git unavailable — fall through to tags / empty.
  }

  try {
    const { stdout: tagOut } = await git(["tag", "-l", "v*"]);
    const tags = tagOut
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    for (const tag of tags) {
      const version = tag.replace(/^v/, "");

      if (!version || byVersion.has(version)) continue;

      try {
        const { stdout: shaOut } = await git(["rev-list", "-n", "1", tag]);
        const sha = shaOut.trim();

        if (sha) byVersion.set(version, sha);
      } catch {
        // ignore bad tags
      }
    }
  } catch {
    // ignore
  }

  return [...byVersion.entries()]
    .map(([version, sha]) => ({ version, sha }))
    .sort((a, b) => compareSemverDesc(a.version, b.version));
}

export async function buildVersionCatalog(
  git: GitRunner = defaultGit,
  currentVersion: string = resolveCurrentAppVersion()
): Promise<VersionCatalog> {
  const versions = await discoverAppVersions(git);
  const current =
    versions.find((v) => v.version === currentVersion) ??
    (versions[0]?.version === currentVersion ? versions[0] : null);

  // If package.json at HEAD matches currentVersion but discovery missed it, resolve HEAD.
  let currentSha = current?.sha ?? null;

  if (!currentSha) {
    try {
      const headShow = await git(["show", "HEAD:package.json"]);
      const headVersion = parsePackageVersion(headShow.stdout);

      if (headVersion === currentVersion) {
        const { stdout } = await git(["rev-parse", "HEAD"]);

        currentSha = stdout.trim() || null;
      }
    } catch {
      // leave null
    }
  }

  const ordered = versions.length
    ? versions
    : currentSha
      ? [{ version: currentVersion, sha: currentSha }]
      : [];

  // Ensure current version appears even if only HEAD resolved it.
  if (
    currentSha &&
    !ordered.some((v) => v.version === currentVersion)
  ) {
    ordered.unshift({ version: currentVersion, sha: currentSha });
    ordered.sort((a, b) => compareSemverDesc(a.version, b.version));
  }

  const currentIndex = ordered.findIndex((v) => v.version === currentVersion);
  const previous =
    currentIndex >= 0 && currentIndex < ordered.length - 1
      ? ordered[currentIndex + 1]
      : ordered.length >= 2 && currentIndex < 0
        ? ordered[1]
        : null;

  return {
    versions: ordered,
    currentVersion,
    currentSha: currentSha ?? ordered.find((v) => v.version === currentVersion)?.sha ?? null,
    previousVersion: previous?.version ?? null,
    previousSha: previous?.sha ?? null,
  };
}

/**
 * Resolve the SHA range for notes about a single version increment
 * (previous version → that version). For the current app version, `to` is HEAD
 * so post-bump commits in the same version string are included.
 */
export async function resolveIncrementRange(
  catalog: VersionCatalog,
  toVersion: string,
  git: GitRunner = defaultGit
): Promise<{ fromSha: string | null; toSha: string | null; fromVersion: string | null }> {
  const idx = catalog.versions.findIndex((v) => v.version === toVersion);

  if (idx < 0) {
    return { fromSha: null, toSha: null, fromVersion: null };
  }

  const target = catalog.versions[idx];
  const previous = catalog.versions[idx + 1] ?? null;
  let toSha = target.sha;

  if (toVersion === catalog.currentVersion) {
    try {
      const { stdout } = await git(["rev-parse", "HEAD"]);
      const head = stdout.trim();

      if (head) toSha = head;
    } catch {
      // keep bump sha
    }
  }

  return {
    fromSha: previous?.sha ?? null,
    toSha,
    fromVersion: previous?.version ?? null,
  };
}

/**
 * Resolve SHAs for an arbitrary version pair (order-independent; returns older→newer).
 */
export function resolveCompareRange(
  catalog: VersionCatalog,
  versionA: string,
  versionB: string
): {
  fromSha: string | null;
  toSha: string | null;
  fromVersion: string | null;
  toVersion: string | null;
} {
  const a = catalog.versions.find((v) => v.version === versionA);
  const b = catalog.versions.find((v) => v.version === versionB);

  if (!a || !b) {
    return { fromSha: null, toSha: null, fromVersion: null, toVersion: null };
  }

  const order = compareSemverDesc(a.version, b.version);

  // compareSemverDesc: positive means a > b (a newer)
  if (order > 0) {
    return { fromSha: b.sha, toSha: a.sha, fromVersion: b.version, toVersion: a.version };
  }
  if (order < 0) {
    return { fromSha: a.sha, toSha: b.sha, fromVersion: a.version, toVersion: b.version };
  }

  return {
    fromSha: a.sha,
    toSha: b.sha,
    fromVersion: a.version,
    toVersion: b.version,
  };
}

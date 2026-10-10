import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitCommitEntry = {
  sha: string;
  subject: string;
  body: string;
  paths: string[];
};

type GitRunner = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

async function defaultGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, {
    cwd: process.cwd(),
    maxBuffer: 16 * 1024 * 1024,
    encoding: "utf8",
  });
}

export const GIT_LOG_RECORD_SEP = "\x1e";
export const GIT_LOG_FIELD_SEP = "\x1f";

/**
 * List commits in (fromSha, toSha] — reachable from toSha but not from fromSha.
 * When fromSha is null, lists commits reachable from toSha (capped).
 */
export async function listCommitsBetween(
  args: { fromSha: string | null; toSha: string; limit?: number },
  git: GitRunner = defaultGit
): Promise<{ commits: GitCommitEntry[]; ok: boolean; error?: string }> {
  const limit = args.limit ?? 200;
  const range = args.fromSha ? `${args.fromSha}..${args.toSha}` : args.toSha;

  try {
    const { stdout } = await git([
      "log",
      range,
      `-n${limit}`,
      `--pretty=format:%H${GIT_LOG_FIELD_SEP}%s${GIT_LOG_FIELD_SEP}%b${GIT_LOG_RECORD_SEP}`,
      "--name-only",
    ]);

    return { commits: parseGitLog(stdout), ok: true };
  } catch (err) {
    return {
      commits: [],
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Format commits for the model prompt (public subjects, bodies, paths only). */
export function formatCommitLogForPrompt(commits: GitCommitEntry[]): string {
  if (commits.length === 0) return "";

  return commits
    .map((c) => {
      const paths =
        c.paths.length > 0
          ? `Paths: ${c.paths.slice(0, 40).join(", ")}${c.paths.length > 40 ? ", …" : ""}`
          : "Paths: (none)";
      const body = c.body.trim() ? `\n${c.body.trim()}` : "";

      return `- ${c.sha.slice(0, 12)} ${c.subject}${body}\n  ${paths}`;
    })
    .join("\n\n");
}

/**
 * Parse `git log --pretty=format:%H%x1f%s%x1f%b%x1e --name-only` output.
 * Paths for commit N appear after its record separator, before commit N+1's header.
 */
export function parseGitLog(raw: string): GitCommitEntry[] {
  const chunks = raw.split(GIT_LOG_RECORD_SEP);
  const commits: GitCommitEntry[] = [];

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i] ?? "";

    if (commits.length > 0) {
      const lines = chunk.split("\n");
      const paths: string[] = [];
      let start = 0;

      while (start < lines.length) {
        const line = lines[start] ?? "";

        if (line === "") {
          start += 1;
          continue;
        }
        if (line.includes(GIT_LOG_FIELD_SEP)) break;
        paths.push(line.trim());
        start += 1;
      }

      commits[commits.length - 1]!.paths = paths.filter(Boolean);
      chunk = lines.slice(start).join("\n");
    }

    const trimmed = chunk.replace(/^\n+/, "");

    if (!trimmed.trim()) continue;

    const first = trimmed.indexOf(GIT_LOG_FIELD_SEP);
    const second = first >= 0 ? trimmed.indexOf(GIT_LOG_FIELD_SEP, first + 1) : -1;

    if (first < 0 || second < 0) continue;

    const sha = trimmed.slice(0, first).trim();
    const subject = trimmed.slice(first + 1, second).trim();
    const body = trimmed.slice(second + 1).trim();

    if (!/^[0-9a-f]{7,40}$/i.test(sha)) continue;

    commits.push({ sha, subject, body, paths: [] });
  }

  return commits;
}

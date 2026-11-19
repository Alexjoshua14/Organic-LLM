#!/usr/bin/env -S bun --no-env-file
/**
 * A light radar for "who else is working here": other coding agents on this machine, the worktrees
 * and ports they use, the files they are touching, and any claims they filed. Built to cost almost
 * no tokens: a digest is about ten lines, `--delta` prints only what changed since this agent's
 * last call, and prints nothing at all when nothing did.
 *
 * It reads process names, working directories, ages and transcript modification times. It never
 * reads transcript content, command-line arguments or environments.
 *
 * Usage (through `bun run radar`, which keeps Bun from loading .env.local):
 *   bun run radar                       digest of the other agents, claims, new ports, collisions
 *   bun run radar --delta               only what changed since your last call (silent if none)
 *   bun run radar claim --title "…" --paths a/**,b.tsx [--port 3001] [--ticket COA-1]
 *   bun run radar release               drop your claim
 *   bun run radar check <path…> [--port N]   is this path or port taken? exit 1 if so
 *   flags: --since MIN (new-port window, 60)  --edits MIN (recent-edit window, 10)
 *          --ports (every dev port)  --files (scan recent edits)  --json  --force
 *
 * Claims live in `<git-common-dir>/agents/claims/<pid>.json`, shared by every worktree of the repo
 * and never committed. A claim is live only while the agent process that filed it is, so nobody
 * has to remember to delete one.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

export type Proc = { pid: number; ppid: number; age: number; comm: string };
export type Worktree = { path: string; branch: string; main: boolean };
export type State = "busy" | "idle" | "?";
export type Agent = {
  pid: number;
  kind: string;
  cwd: string;
  age: number;
  state: State;
  place: string;
  inRepo: boolean;
};
export type Claim = {
  pid: number;
  kind: string;
  title: string;
  paths: string[];
  ports: number[];
  ticket?: string;
  cwd: string;
  /** Epoch seconds when the filing process started; guards against pid reuse. */
  procStart: number;
};
export type ListeningPort = { port: number; proc: string; pid: number };
export type Snapshot = Record<string, string>;

export const AGENT_KINDS = new Set(["claude", "codex", "cursor-agent", "gemini", "opencode", "aider"]);
const BUSY_WITHIN_S = 90;
const DELTA_MIN_GAP_MS = 15_000;

// ---------------------------------------------------------------------------------------------
// Pure helpers (unit-tested)

export function parsePs(text: string): Proc[] {
  const out: Proc[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ pid: Number(m[1]), ppid: Number(m[2]), age: Number(m[3]), comm: m[4]! });
  }
  return out;
}

/** Agent processes whose parent is not itself an agent: one entry per agent, not per helper. */
export function topLevelAgents(procs: Proc[], kinds = AGENT_KINDS): Proc[] {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  return procs.filter((p) => kinds.has(p.comm) && !kinds.has(byPid.get(p.ppid)?.comm ?? ""));
}

/** This process and every ancestor, nearest first. */
export function lineage(pid: number, procs: Proc[]): Proc[] {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const out: Proc[] = [];
  for (let p = byPid.get(pid); p && out.length < 32; p = byPid.get(p.ppid)) out.push(p);
  return out;
}

/** Claude Code names a project folder after the working directory, every non-alphanumeric as `-`. */
export function encodeProjectDir(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, "-");
}

export function formatAge(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

export function parseWorktrees(porcelain: string): Worktree[] {
  const out: Worktree[] = [];
  for (const block of porcelain.split(/\n\n+/)) {
    const path = /^worktree (.+)$/m.exec(block)?.[1];
    if (!path) continue;
    const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? "(detached)";
    out.push({ path, branch, main: out.length === 0 });
  }
  return out;
}

/** Which worktree a directory sits in, and a short label for it. */
export function placeOf(cwd: string, worktrees: Worktree[], home: string): { place: string; inRepo: boolean } {
  const hit = worktrees
    .filter((w) => cwd === w.path || cwd.startsWith(`${w.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (hit) {
    const label = hit.main ? "main" : basename(hit.path).replace(/^(t3-[0-9a-f]{8})[0-9a-f-]*$/, "$1");
    return { place: `${label} (${hit.branch})`, inRepo: true };
  }
  return { place: cwd === home ? "~" : cwd.replace(home, "~"), inRepo: false };
}

export function parsePortRanges(spec: string): (port: number) => boolean {
  const ranges = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, b] = s.split("-").map(Number);
      return [a!, b ?? a!] as const;
    });
  return (port) => ranges.some(([lo, hi]) => port >= lo && port <= hi);
}

/** `ss -ltnpH` rows: local address, then `users:(("name",pid=N,fd=M))` when visible. */
export function parseSs(text: string): ListeningPort[] {
  const out = new Map<number, ListeningPort>();
  for (const line of text.split("\n")) {
    const cols = line.trim().split(/\s+/);
    const local = cols[3];
    const port = Number(local?.slice(local.lastIndexOf(":") + 1));
    if (!port) continue;
    const owner = /\("([^"]+)",pid=(\d+)/.exec(line);
    out.set(port, { port, proc: owner?.[1] ?? "?", pid: Number(owner?.[2] ?? 0) });
  }
  return [...out.values()].sort((a, b) => a.port - b.port);
}

/** Directory prefix of a path or glob: `app/**\/x.tsx` -> `app`, `a/b/*.tsx` -> `a/b`. */
function prefixOf(p: string): string {
  const clean = p.replace(/^\.\//, "");
  const cut = clean.search(/[*?[{]/);
  return (cut === -1 ? clean : clean.slice(0, cut)).replace(/\/+$/, "");
}

export function pathsOverlap(a: string, b: string): boolean {
  const x = prefixOf(a);
  const y = prefixOf(b);
  if (!x || !y) return true; // a bare `**` claims everything
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
}

export function claimIsLive(claim: Claim, procs: Proc[], nowS: number): boolean {
  const p = procs.find((q) => q.pid === claim.pid);
  return !!p && Math.abs(nowS - p.age - claim.procStart) <= 10;
}

/** Lines that appeared (+) or vanished (-) between two snapshots. Order is stable. */
export function diffSnapshots(prev: Snapshot, next: Snapshot): string[] {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(next)) if (!(k in prev)) lines.push(`+ ${v}`);
  for (const [k, v] of Object.entries(prev)) if (!(k in next)) lines.push(`- ${v}`);
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Machine access

function run(cmd: string[], cwd?: string): string {
  try {
    const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    return r.exitCode === 0 ? r.stdout.toString() : "";
  } catch {
    return "";
  }
}

function cwdOf(pid: number): string | undefined {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return undefined;
  }
}

function newestMtimeMs(dir: string, suffix: string): number {
  try {
    let newest = 0;
    for (const name of readdirSync(dir)) {
      if (name.endsWith(suffix)) newest = Math.max(newest, statSync(join(dir, name)).mtimeMs);
    }
    return newest;
  } catch {
    return 0;
  }
}

function codexNewestMs(home: string): number {
  const now = new Date();
  let newest = 0;
  for (const offset of [0, 1]) {
    const d = new Date(now.getTime() - offset * 86_400_000);
    const dir = join(home, ".codex", "sessions", String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"));
    newest = Math.max(newest, newestMtimeMs(dir, ".jsonl"));
  }
  return newest;
}

function activity(kind: string, cwd: string, home: string, codexCount: number): State {
  const now = Date.now();
  if (kind === "claude") {
    const t = newestMtimeMs(join(home, ".claude", "projects", encodeProjectDir(cwd)), ".jsonl");
    return t === 0 ? "?" : now - t < BUSY_WITHIN_S * 1000 ? "busy" : "idle";
  }
  if (kind === "codex" && codexCount === 1) {
    const t = codexNewestMs(home);
    return t === 0 ? "?" : now - t < BUSY_WITHIN_S * 1000 ? "busy" : "idle";
  }
  return "?";
}

type Env = {
  home: string;
  commonDir: string;
  worktrees: Worktree[];
  procs: Proc[];
  mine?: Proc;
  here: Worktree | undefined;
  now: number;
};

function loadEnv(): Env {
  const home = homedir();
  const cwd = process.cwd();
  let commonDir = run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd).trim();
  if (!commonDir) commonDir = join(cwd, ".git");
  const worktrees = parseWorktrees(run(["git", "worktree", "list", "--porcelain"], cwd));
  const procs =
    process.platform === "linux" ? parsePs(run(["ps", "-eo", "pid=,ppid=,etimes=,comm="])) : [];
  const mine = lineage(process.pid, procs).find((p) => AGENT_KINDS.has(p.comm));
  const here = worktrees
    .filter((w) => cwd === w.path || cwd.startsWith(`${w.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return { home, commonDir, worktrees, procs, mine, here, now: Date.now() };
}

function otherAgents(env: Env): Agent[] {
  const tops = topLevelAgents(env.procs).filter((p) => p.pid !== env.mine?.pid);
  const codexCount = topLevelAgents(env.procs).filter((p) => p.comm === "codex").length;
  const out: Agent[] = [];
  for (const p of tops) {
    const cwd = cwdOf(p.pid);
    if (!cwd || /\/t3code-claude-title-/.test(cwd)) continue; // one-shot title helpers, not agents
    const { place, inRepo } = placeOf(cwd, env.worktrees, env.home);
    out.push({ pid: p.pid, kind: p.comm, cwd, age: p.age, state: activity(p.comm, cwd, env.home, codexCount), place, inRepo });
  }
  return out.sort((a, b) => a.age - b.age);
}

const claimsDir = (env: Env) => join(env.commonDir, "agents", "claims");

function readClaims(env: Env): Claim[] {
  const dir = claimsDir(env);
  if (!existsSync(dir)) return [];
  const live: Claim[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const file = join(dir, name);
    try {
      const claim = JSON.parse(readFileSync(file, "utf8")) as Claim;
      if (env.procs.length === 0 || claimIsLive(claim, env.procs, env.now / 1000)) live.push(claim);
      else rmSync(file, { force: true }); // its agent is gone, so the claim is stale
    } catch {
      rmSync(file, { force: true });
    }
  }
  return live.filter((c) => c.pid !== env.mine?.pid);
}

function listeningPorts(env: Env, inRange: (p: number) => boolean) {
  const byPid = new Map(env.procs.map((p) => [p.pid, p]));
  return parseSs(run(["ss", "-ltnpH"]))
    .filter((p) => inRange(p.port))
    .map((p) => {
      const cwd = p.pid ? cwdOf(p.pid) : undefined;
      return {
        ...p,
        age: byPid.get(p.pid)?.age,
        where: cwd ? placeOf(cwd, env.worktrees, env.home).place.replace(/ \(.*\)$/, "") : "",
      };
    });
}

/** Files edited recently in a checkout, newest first. Slow-ish (git status), so opt-in. */
function recentEdits(dir: string, minutes: number, skip: string[]): string[] {
  const out = run(["git", "status", "--porcelain=v1", "-z", "-uall"], dir);
  const cutoff = Date.now() - minutes * 60_000;
  const hits: Array<[string, number]> = [];
  const entries = out.split("\0").filter(Boolean);
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i]!;
    const path = e.slice(3);
    if (e[0] === "R" || e[0] === "C") i += 1;
    if (skip.some((s) => pathsOverlap(path, s))) continue;
    try {
      const t = statSync(join(dir, path)).mtimeMs;
      if (t >= cutoff) hits.push([path, t]);
    } catch {
      /* deleted or unreadable */
    }
  }
  return hits.sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

// ---------------------------------------------------------------------------------------------
// Digest

type Opts = {
  delta: boolean;
  json: boolean;
  force: boolean;
  files: boolean;
  allPorts: boolean;
  sinceMin: number;
  editsMin: number;
  title: string;
  paths: string[];
  ports: number[];
  ticket?: string;
  rest: string[];
};

function parseArgs(argv: string[]): { cmd: string; opts: Opts } {
  const opts: Opts = { delta: false, json: false, force: false, files: false, allPorts: false, sinceMin: 60, editsMin: 10, title: "", paths: [], ports: [], rest: [] };
  let cmd = "status";
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    const next = () => argv[++i] ?? "";
    if (["status", "claim", "release", "check"].includes(a) && i === 0) cmd = a;
    else if (a === "--delta") opts.delta = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--files") opts.files = true;
    else if (a === "--ports") opts.allPorts = true;
    else if (a === "--since") opts.sinceMin = Number(next()) || 60;
    else if (a === "--edits") opts.editsMin = Number(next()) || 10;
    else if (a === "--title") opts.title = next();
    else if (a === "--paths") opts.paths = next().split(",").filter(Boolean);
    else if (a === "--port") opts.ports = next().split(",").map(Number).filter(Boolean);
    else if (a === "--ticket") opts.ticket = next();
    else opts.rest.push(a);
  }
  return { cmd, opts };
}

function buildSnapshot(env: Env, opts: Opts) {
  const lines: string[] = [];
  const snap: Snapshot = {};
  const agents = otherAgents(env);
  const claims = readClaims(env);
  const inRange = parsePortRanges(process.env.RADAR_PORTS ?? "3000-3999,5173,8000-8099");
  const ports = listeningPorts(env, inRange).filter((p) => opts.allPorts || (p.age !== undefined && p.age < opts.sinceMin * 60));

  const inRepo = agents.filter((a) => a.inRepo);
  const elsewhere = agents.filter((a) => !a.inRepo);
  const myPlace = placeOf(process.cwd(), env.worktrees, env.home).place;
  const sharing = inRepo.some((a) => a.place === myPlace);

  for (const a of inRepo) {
    const note = a.place === myPlace ? "  <- shares your checkout" : "";
    const text = `${a.kind.padEnd(7)} ${a.place}`;
    snap[`agent:${a.pid}`] = `${text}${note}`;
    lines.push(`  ${text.padEnd(46)} ${a.state.padEnd(4)} ${formatAge(a.age)}${note}`);
  }
  const elsewhereText = elsewhere.map((a) => `${a.kind}@${a.place} ${a.state === "?" ? "" : `${a.state} `}${formatAge(a.age)}`.replace(/\s+/g, " ").trim());
  for (const a of elsewhere) snap[`agent:${a.pid}`] = `${a.kind} elsewhere (${a.place})`;

  const claimLines = claims.map((c) => {
    snap[`claim:${c.pid}`] = `claim ${c.kind}(${c.pid}): ${c.title}`;
    const bits = [...c.paths, ...c.ports.map((p) => `:${p}`)].join(" ");
    return `  ${c.kind}(${c.pid}) ${c.title}${c.ticket ? ` [${c.ticket}]` : ""}${bits ? ` — ${bits}` : ""}`;
  });
  const portLines = ports.map((p) => {
    snap[`port:${p.port}`] = `port :${p.port} ${p.proc}${p.where ? ` @${p.where}` : ""}`;
    return `:${p.port} ${p.proc}${p.where ? `@${p.where}` : ""}${p.age !== undefined ? ` ${formatAge(p.age)}` : ""}`;
  });

  // Collisions worth interrupting for: overlapping claims, and edits by someone sharing the checkout.
  const warnings: string[] = [];
  const mine = readOwnClaim(env);
  if (mine) {
    for (const c of claims) {
      for (const p of mine.paths) {
        const hit = c.paths.find((q) => pathsOverlap(p, q));
        if (hit) {
          snap[`overlap:${c.pid}:${p}`] = `OVERLAP your claim ${p} and ${c.kind}(${c.pid}) ${hit}`;
          warnings.push(`overlap: your ${p} and ${c.kind}(${c.pid})'s ${hit}`);
        }
      }
      for (const port of mine.ports) {
        if (c.ports.includes(port)) {
          snap[`portclash:${c.pid}:${port}`] = `OVERLAP port :${port} also claimed by ${c.kind}(${c.pid})`;
          warnings.push(`port :${port} is also claimed by ${c.kind}(${c.pid})`);
        }
      }
    }
  }
  if ((sharing || opts.files) && env.here) {
    const edits = recentEdits(env.here.path, opts.editsMin, mine?.paths ?? []);
    if (edits.length) {
      const shown = edits.slice(0, 3).join(", ");
      const whose = mine ? " outside your claim" : " (yours or theirs: file a claim and yours drop out)";
      warnings.push(`edited ≤${opts.editsMin}m${whose}: ${shown}${edits.length > 3 ? ` +${edits.length - 3}` : ""}`);
      if (sharing) snap[`edits:${edits.slice(0, 3).join("|")}`] = `edited ≤${opts.editsMin}m: ${edits.slice(0, 3).join(", ")}`;
    }
  }
  return { snap, agentLines: lines, elsewhereText, claimLines, portLines, warnings, total: agents.length };
}

function readOwnClaim(env: Env): Claim | undefined {
  if (!env.mine) return undefined;
  const file = join(claimsDir(env), `${env.mine.pid}.json`);
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Claim;
  } catch {
    return undefined;
  }
}

function renderStatus(env: Env, d: ReturnType<typeof buildSnapshot>): string {
  const t = new Date(env.now).toTimeString().slice(0, 5);
  const you = env.mine ? `${env.mine.comm}@${placeOf(process.cwd(), env.worktrees, env.home).place}` : "not inside a known agent";
  const out = [`radar ${t} · you: ${you} · ${d.total} other agent${d.total === 1 ? "" : "s"}`];
  if (process.platform !== "linux") out.push("  (process scan needs Linux; claims and files still work)");
  if (d.agentLines.length) out.push("here:", ...d.agentLines);
  if (d.elsewhereText.length) out.push(`elsewhere: ${d.elsewhereText.join(", ")}`);
  if (d.claimLines.length) out.push("claims:", ...d.claimLines);
  if (d.portLines.length) out.push(`ports: ${d.portLines.join(", ")}`);
  for (const w of d.warnings) out.push(`⚠ ${w}`);
  return out.join("\n");
}

function cmdStatus(env: Env, opts: Opts) {
  const stateDir = join(env.commonDir, "agents", "radar");
  const stateFile = env.mine ? join(stateDir, `${env.mine.pid}.json`) : undefined;
  let prev: { t: number; snap: Snapshot } | undefined;
  if (opts.delta && stateFile && existsSync(stateFile)) {
    try {
      prev = JSON.parse(readFileSync(stateFile, "utf8"));
    } catch {
      prev = undefined;
    }
    if (prev && !opts.force && env.now - prev.t < DELTA_MIN_GAP_MS) return;
  }
  const d = buildSnapshot(env, opts);
  if (opts.delta && stateFile) {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(stateFile, JSON.stringify({ t: env.now, snap: d.snap }));
    pruneState(stateDir, env);
  }
  if (opts.json) {
    const { snap, ...rest } = d;
    return console.log(JSON.stringify({ ...rest, snapshot: snap }, null, 2));
  }
  if (opts.delta && prev) {
    const changes = diffSnapshots(prev.snap, d.snap);
    if (changes.length) console.log(["radar Δ", ...changes.map((c) => `  ${c}`)].join("\n"));
    return; // nothing changed: print nothing, spend nothing
  }
  console.log(renderStatus(env, d));
}

function pruneState(dir: string, env: Env) {
  if (env.procs.length === 0) return;
  for (const name of readdirSync(dir)) {
    const pid = Number(name.replace(/\.json$/, ""));
    if (pid && !env.procs.some((p) => p.pid === pid)) rmSync(join(dir, name), { force: true });
  }
}

function cmdClaim(env: Env, opts: Opts) {
  if (!opts.title) return die("claim needs --title \"what you are doing\"");
  const pid = env.mine?.pid ?? process.ppid;
  const proc = env.procs.find((p) => p.pid === pid);
  const claim: Claim = {
    pid,
    kind: env.mine?.comm ?? "shell",
    title: opts.title,
    paths: opts.paths,
    ports: opts.ports,
    ticket: opts.ticket,
    cwd: process.cwd(),
    procStart: Math.round(env.now / 1000 - (proc?.age ?? 0)),
  };
  mkdirSync(claimsDir(env), { recursive: true });
  writeFileSync(join(claimsDir(env), `${pid}.json`), JSON.stringify(claim));
  const clashes = buildSnapshot(env, { ...opts }).warnings.filter((w) => w.startsWith("overlap") || w.startsWith("port"));
  console.log(`claimed: ${claim.title}${claim.paths.length ? ` — ${claim.paths.join(" ")}` : ""}${claim.ports.length ? ` :${claim.ports.join(" :")}` : ""}`);
  for (const c of clashes) console.log(`⚠ ${c}`);
  if (clashes.length) process.exit(1);
}

function cmdRelease(env: Env) {
  const pid = env.mine?.pid ?? process.ppid;
  rmSync(join(claimsDir(env), `${pid}.json`), { force: true });
  console.log("released");
}

function cmdCheck(env: Env, opts: Opts) {
  const problems: string[] = [];
  const claims = readClaims(env);
  for (const p of opts.rest) {
    for (const c of claims) {
      const hit = c.paths.find((q) => pathsOverlap(p, q));
      if (hit) problems.push(`${p}: claimed by ${c.kind}(${c.pid}) "${c.title}" (${hit})`);
    }
  }
  const inRange = () => true;
  for (const port of opts.ports) {
    const live = listeningPorts(env, inRange).find((x) => x.port === port);
    if (live) problems.push(`:${port}: in use by ${live.proc}${live.where ? ` @${live.where}` : ""}`);
    for (const c of claims) if (c.ports.includes(port)) problems.push(`:${port}: claimed by ${c.kind}(${c.pid}) "${c.title}"`);
  }
  const sharing = otherAgents(env).some((a) => a.inRepo && placeOf(process.cwd(), env.worktrees, env.home).place === a.place);
  if (sharing && env.here && opts.rest.length) {
    // Paths under your own claim are yours; only the rest can be someone else's edit.
    const edits = recentEdits(env.here.path, opts.editsMin, readOwnClaim(env)?.paths ?? []).filter((e) =>
      opts.rest.some((p) => pathsOverlap(e, p))
    );
    for (const e of edits) problems.push(`${e}: edited ≤${opts.editsMin}m in a checkout another agent shares`);
  }
  if (problems.length === 0) return console.log("clear");
  for (const p of problems) console.log(`⚠ ${p}`);
  process.exit(1);
}

function die(msg: string): never {
  console.error(`radar: ${msg}`);
  process.exit(2);
}

function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  if (cmd === "claim") return cmdClaim(env, opts);
  if (cmd === "release") return cmdRelease(env);
  if (cmd === "check") return cmdCheck(env, opts);
  return cmdStatus(env, opts);
}

if (import.meta.main) main();

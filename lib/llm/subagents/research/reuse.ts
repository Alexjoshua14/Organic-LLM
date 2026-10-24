import "server-only";

import type { ResearchLedger, ResearchLedgerSession, ResearchSource } from "./ledger";
import type { ResearchReuseEntry } from "./reuse-schema";

import { createHash } from "node:crypto";

import { z } from "zod";

import { RESEARCH_REUSE_LIMIT, ResearchAnnotationSchema } from "./reuse-schema";

import { assertSafePublicHttpsUrl } from "@/lib/security/external-content/safe-url";

const ANNOTATION_PROMPT_VERSION = "lyra-source-annotation-v1";
const MAX_TTL_SECONDS = 86_400;
const PolicySchema = z.object({
  version: z.literal(1),
  grants: z
    .array(
      z.object({
        provider: z.enum(["exa", "firecrawl", "docling"]),
        // Reference to a reviewed agreement AND publisher rights, not the agreement text.
        reference: z.string().trim().min(1).max(500),
        expiresAt: z.string().datetime(),
        urlPrefixes: z.array(z.string().url().max(2_000)).min(1).max(50),
        purposes: z
          .array(z.enum(["retrieval", "annotation"]))
          .min(1)
          .max(2),
        maxTtlSeconds: z.number().int().min(1).max(MAX_TTL_SECONDS),
      })
    )
    .max(20),
});

export type ResearchReusePolicy = z.infer<typeof PolicySchema>;

/** No public Exa terms grant was found for app caching. No implicit permission or model override. */
export function readResearchReusePolicy(
  raw = process.env.RESEARCH_REUSE_POLICY
): ResearchReusePolicy {
  try {
    if (!raw || raw.length > 64_000) return { version: 1, grants: [] };
    const policy = PolicySchema.parse(JSON.parse(raw));

    if (
      policy.grants.some((grant) =>
        grant.urlPrefixes.some((url) => !assertSafePublicHttpsUrl(url).ok)
      )
    )
      return { version: 1, grants: [] };

    return policy;
  } catch {
    return { version: 1, grants: [] };
  }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)])
    );

  return value;
}
export function researchReuseKey(kind: string, input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify([kind, stable(input)]))
    .digest("hex");
}
export function researchUrlKey(raw: string): string {
  const safe = assertSafePublicHttpsUrl(raw);

  if (!safe.ok) throw new Error("Research sources must use public HTTPS URLs.");
  const url = new URL(safe.href);

  url.hash = "";

  return url.href;
}
function matchesPrefix(raw: string, rawPrefix: string): boolean {
  const url = new URL(researchUrlKey(raw));
  const prefix = new URL(researchUrlKey(rawPrefix));

  return (
    url.origin === prefix.origin &&
    (url.pathname === prefix.pathname ||
      (prefix.pathname.endsWith("/") && url.pathname.startsWith(prefix.pathname))) &&
    (!prefix.search || url.search === prefix.search)
  );
}

function approval(
  policy: ResearchReusePolicy,
  kind: ResearchReuseEntry["kind"],
  sources: ResearchSource[],
  now: number
) {
  if (!sources.length) return null;
  const grants = sources.map((source) =>
    policy.grants.find(
      (grant) =>
        grant.provider === source.provider &&
        Date.parse(grant.expiresAt) > now &&
        grant.purposes.includes(kind === "annotation" ? "annotation" : "retrieval") &&
        grant.urlPrefixes.some((prefix) => matchesPrefix(source.url, prefix))
    )
  );

  if (grants.some((grant) => !grant)) return null;
  const ttl = kind === "search" ? 300 : kind === "read" ? 3_600 : MAX_TTL_SECONDS;
  const expiresAt = Math.min(
    ...grants.map((grant) =>
      Math.min(Date.parse(grant!.expiresAt), now + Math.min(ttl, grant!.maxTtlSeconds) * 1_000)
    )
  );

  return { digest: researchReuseKey("approvals", grants), expiresAt };
}

export function findResearchReuse(
  ledger: ResearchLedger,
  key: string,
  kind: ResearchReuseEntry["kind"],
  policy: ResearchReusePolicy,
  now: string
) {
  const stamp = Date.parse(now);
  const entry = ledger.reuse.find((item) => item.key === key && item.kind === kind);

  if (
    !entry ||
    !Number.isFinite(stamp) ||
    Date.parse(entry.createdAt) > stamp ||
    Date.parse(entry.expiresAt) <= stamp
  )
    return null;
  const sources = entry.sourceIds.map((id) => ledger.sources.find((source) => source.id === id));

  if (sources.some((source) => !source)) return null;
  const resolved = sources as ResearchSource[];
  const allowed = approval(policy, kind, resolved, stamp);

  if (
    !allowed ||
    entry.approvalDigest !== allowed.digest ||
    (kind === "annotation" && !entry.annotation)
  )
    return null;

  return { entry, sources: resolved };
}

/** Stores references to immutable evidence, not a second copy of page text. Cache failure is non-fatal. */
export async function saveResearchReuse(
  session: ResearchLedgerSession,
  items: {
    key: string;
    kind: ResearchReuseEntry["kind"];
    sourceIds: string[];
    annotation?: z.infer<typeof ResearchAnnotationSchema>;
  }[],
  policy: ResearchReusePolicy,
  now: string
): Promise<number> {
  if (!policy.grants.length || !items.length || !Number.isFinite(Date.parse(now))) return 0;
  try {
    const edited = await session.mutate((ledger) => {
      const reuse = ledger.reuse.filter((entry) => Date.parse(entry.expiresAt) > Date.parse(now));
      let saved = 0;

      for (const item of items) {
        if (!item.sourceIds.length || item.sourceIds.length > 10) continue;
        const sources = item.sourceIds.map((id) =>
          ledger.sources.find((source) => source.id === id)
        );

        if (sources.some((source) => !source)) continue;
        const allowed = approval(policy, item.kind, sources as ResearchSource[], Date.parse(now));

        if (
          !allowed ||
          (item.kind === "annotation" &&
            !ResearchAnnotationSchema.safeParse(item.annotation).success)
        )
          continue;
        const existing = reuse.findIndex(
          (entry) => entry.key === item.key && entry.kind === item.kind
        );

        if (existing >= 0) reuse.splice(existing, 1);
        reuse.push({
          ...item,
          approvalDigest: allowed.digest,
          createdAt: now,
          expiresAt: new Date(allowed.expiresAt).toISOString(),
        });
        saved += 1;
      }
      if (!saved) return { ok: false, error: "No eligible cache entries." };

      return {
        ok: true,
        ledger: { ...ledger, reuse: reuse.slice(-RESEARCH_REUSE_LIMIT) },
        value: saved,
      };
    });

    return edited.ok ? edited.value : 0;
  } catch {
    return 0;
  }
}

export function researchAnnotationKey(
  source: ResearchSource,
  modelId: string,
  context: string,
  generationContextHash = ""
) {
  return researchReuseKey("annotation", {
    url: source.url,
    provider: source.provider,
    sha256: source.sha256,
    excerptOnly: source.excerptOnly,
    truncated: source.truncated,
    modelId,
    promptVersion: ANNOTATION_PROMPT_VERSION,
    context,
    generationContextHash,
  });
}

export async function invalidateResearchReuse(session: ResearchLedgerSession, keys: string[]) {
  if (!keys.length) return;
  try {
    await session.mutate((ledger) => {
      const reuse = ledger.reuse.filter((entry) => !keys.includes(entry.key));

      return reuse.length === ledger.reuse.length
        ? { ok: false, error: "No cached entry to invalidate." }
        : { ok: true, ledger: { ...ledger, reuse }, value: null };
    });
  } catch {
    // Refresh still fetches; an unavailable cache must never prevent research.
  }
}

// Collapse concurrent requests in this process; durable hits still require an owned ledger read.
const requests = new Map<string, Promise<unknown>>();

export async function withResearchReuseLock<T>(
  ownerId: string,
  threadId: string,
  task: () => Promise<T>
): Promise<T> {
  const key = researchReuseKey("request-lock", { ownerId, threadId });
  const previous = requests.get(key) ?? Promise.resolve();

  if (!requests.has(key) && requests.size >= 128) return task();
  const next = previous.catch(() => undefined).then(task);

  requests.set(key, next);
  try {
    return await next;
  } finally {
    if (requests.get(key) === next) requests.delete(key);
  }
}

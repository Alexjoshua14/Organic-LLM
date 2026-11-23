import { z } from "zod";

import { MeasureToneSchema } from "./measure";
import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const ProfileNodeKindSchema = z.enum([
  "person",
  "project",
  "goal",
  "concept",
  "tool",
  "interest",
]);

export const ProfileNodeStatusSchema = z.enum(["active", "paused", "done", "idea"]);

export const ProfileEvidenceSchema = z.object({
  /** e.g. "chat 2026-09-26", "mem0:2244aaf8" */
  source: z.string().min(1),
  quote: optionalStringCatch(),
  /** ISO date when known. */
  at: optionalStringCatch(),
});

export const ProfileNodeSchema = z.object({
  id: z.string().min(1),
  kind: ProfileNodeKindSchema,
  title: z.string().min(1),
  /** Must match a `domains[].id` on the block. */
  domain: z.string().min(1),
  summary: optionalStringCatch(),
  complexity: z.number().int().min(1).max(5),
  status: ProfileNodeStatusSchema.default("active"),
  /** Outbound edges only; dependents are derived. */
  dependencies: z.array(z.string().min(1)).max(20).default([]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(ProfileEvidenceSchema).max(12).default([]),
  updatedAt: optionalStringCatch(),
});

export const ProfileDomainSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  tone: MeasureToneSchema.default("accent"),
});

/**
 * Living Profile map: domains + nodes with dependency chips.
 * Writes stay on the host via `onEdit` / `onDelete` — not in the LLM payload.
 */
export const ProfileMapBlockSchema = z
  .object({
    type: z.literal("profile-map"),
    version: GEN_UI_VERSION,
    title: z.string().min(1),
    /** Supabase profile id === Mem0 user id when wired. */
    profileId: optionalStringCatch(),
    domains: z.array(ProfileDomainSchema).min(1).max(8),
    nodes: z.array(ProfileNodeSchema).min(1).max(60),
  })
  .superRefine((block, ctx) => {
    const ids = new Set(block.nodes.map((n) => n.id));
    const domains = new Set(block.domains.map((d) => d.id));

    block.nodes.forEach((node, i) => {
      if (!domains.has(node.domain)) {
        ctx.addIssue({
          code: "custom",
          path: ["nodes", i, "domain"],
          message: `unknown domain ${node.domain}`,
        });
      }

      for (const dep of node.dependencies) {
        if (!ids.has(dep)) {
          ctx.addIssue({
            code: "custom",
            path: ["nodes", i, "dependencies"],
            message: `unknown dependency ${dep}`,
          });
        }
      }
    });
  });

export type ProfileNode = z.infer<typeof ProfileNodeSchema>;
export type ProfileMapBlock = z.infer<typeof ProfileMapBlockSchema>;
export type ProfileNodeKind = z.infer<typeof ProfileNodeKindSchema>;
export type ProfileEvidence = z.infer<typeof ProfileEvidenceSchema>;
export type ProfileDomain = z.infer<typeof ProfileDomainSchema>;

/** Invert dependency edges so each node lists who depends on it. */
export function deriveDependents(nodes: ProfileNode[]): Map<string, string[]> {
  const out = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const node of nodes) {
    for (const dep of node.dependencies) {
      out.get(dep)?.push(node.id);
    }
  }

  return out;
}

export function profileMapToMarkdown(block: ProfileMapBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];
  const dependents = deriveDependents(block.nodes);

  for (const domain of block.domains) {
    const nodes = block.nodes.filter((n) => n.domain === domain.id);

    if (!nodes.length) continue;

    lines.push(`### ${domain.label}`, "");

    for (const node of nodes) {
      const feeds = dependents.get(node.id) ?? [];
      const meta = [
        node.kind,
        node.status,
        `complexity ${node.complexity}/5`,
        `${Math.round(node.confidence * 100)}%`,
      ].join(" · ");

      lines.push(`- **${node.title}** (${meta})`);
      if (node.summary) lines.push(`  - ${node.summary}`);
      if (node.dependencies.length) {
        lines.push(`  - Needs: ${node.dependencies.map((id) => lookupTitle(block, id)).join(", ")}`);
      }
      if (feeds.length) {
        lines.push(`  - Feeds: ${feeds.map((id) => lookupTitle(block, id)).join(", ")}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

function lookupTitle(block: ProfileMapBlock, id: string): string {
  return block.nodes.find((n) => n.id === id)?.title ?? id;
}

export function profileMapToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Living profile";

  return `## ${title}\n\n_(Profile map — structured view unavailable)_`;
}

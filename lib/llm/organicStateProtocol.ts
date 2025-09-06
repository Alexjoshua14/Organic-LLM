import { randomUUID as nodeRandomUUID } from "node:crypto";

import { z } from "zod";

import {
  OrganicState,
  OrganicStateSchema,
} from "../schemas/organicStateSchema";

/* UUID that works on Node and Edge */
const uid = () =>
  typeof crypto !== "undefined" &&
  typeof (crypto as any).randomUUID === "function"
    ? (crypto as any).randomUUID()
    : nodeRandomUUID();

/* ---------- Allowed Ops ---------- */
export const OpSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_key_insight"),
    text: z.string().min(1),
    tags: z.array(z.string()).max(8).optional(),
    source: z.string().url().optional(),
    importance: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    type: z.literal("add_tech_stack_item"),
    name: z.string().min(1),
    category: z.enum([
      "frontend",
      "backend",
      "devops",
      "ai",
      "native",
      "data",
      "design",
    ]),
    notes: z.string().optional(),
    link: z.string().url().optional(),
  }),
  z.object({
    type: z.literal("add_goal"),
    label: z.string().min(1),
    area: z
      .enum(["native", "orchestration", "ux", "infra", "research"])
      .optional(),
    targetDate: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("update_checkpoint"),
    checkpointId: z.enum([
      "system_surface",
      "device_fabric",
      "sensory_language",
      "contextual_interweave",
      "paradigm_moment",
    ]),
    status: z.enum(["planned", "in_progress", "done"]),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("view_key_insights"),
    filterTags: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
]);
export type Op = z.infer<typeof OpSchema>;

export const OpsEnvelopeSchema = z.object({
  ops: z.array(OpSchema).max(5),
});
export type OpsEnvelope = z.infer<typeof OpsEnvelopeSchema>;

/* ---------- Extract the LAST fenced JSON block ---------- */
export function extractOpsEnvelopeFromText(text: string): OpsEnvelope | null {
  const re = /```json\s*([\s\S]*?)\s*```/gi;
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;

  while ((m = re.exec(text)) !== null) last = m;
  if (!last) return null;
  try {
    const parsed = JSON.parse(last[1]);

    return OpsEnvelopeSchema.parse(parsed);
  } catch {
    return null;
  }
}

/* Remove only the last fenced block (SUP block), keep earlier code intact */
export function stripOpsFence(text: string): string {
  const re = /```json\s*([\s\S]*?)\s*```/gi;
  const all = Array.from(text.matchAll(re));

  if (all.length === 0) return text;
  const last = all[all.length - 1];

  return (
    text.slice(0, last.index) + text.slice((last.index ?? 0) + last[0].length)
  );
}

/* ---------- Pure transformer ---------- */
export async function applyOps(
  state: OrganicState,
  env: OpsEnvelope,
): Promise<OrganicState> {
  const now = new Date().toISOString();
  let next = { ...state };

  for (const op of env.ops) {
    switch (op.type) {
      case "add_key_insight": {
        next.keyInsights = [
          {
            id: uid(),
            text: op.text,
            tags: op.tags ?? [],
            source: op.source,
            importance: op.importance ?? 3,
            createdAt: now,
          },
          ...next.keyInsights,
        ];
        break;
      }

      case "add_tech_stack_item": {
        const name = op.name.trim();

        if (
          !next.techStack.some(
            (t) => t.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          next.techStack = [
            {
              id: uid(),
              name,
              category: op.category,
              notes: op.notes,
              link: op.link,
              addedAt: now,
            },
            ...next.techStack,
          ];
        }
        break;
      }

      case "add_goal": {
        next.goals = [
          {
            id: uid(),
            label: op.label,
            area: op.area ?? "native",
            targetDate: op.targetDate,
            status: "planned",
            createdAt: now,
          },
          ...next.goals,
        ];
        break;
      }

      case "update_checkpoint": {
        next.checkpoints = next.checkpoints.map((c) =>
          c.id === op.checkpointId
            ? {
                ...c,
                status: op.status,
                evidence: op.note ? [op.note, ...c.evidence] : c.evidence,
                updatedAt: now,
              }
            : c,
        );
        break;
      }

      case "view_key_insights":
        // no mutation; your route/UI can render a panel from current state
        break;

      default:
        ((_: never) => _)(op);
    }
  }

  next.lastUpdated = now;

  return OrganicStateSchema.parse(next);
}

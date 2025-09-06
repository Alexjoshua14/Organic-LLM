import { z } from "zod";

/* ---------- Entities ---------- */
export const InsightSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  tags: z.array(z.string()).default([]),
  source: z.string().url().optional(),
  importance: z.number().int().min(1).max(5).default(3),
  createdAt: z.string().datetime(),
});
export type Insight = z.infer<typeof InsightSchema>;

export const TechCategory = z.enum([
  "frontend",
  "backend",
  "devops",
  "ai",
  "native",
  "data",
  "design",
  "diagram",
]);
export type TechCategory = z.infer<typeof TechCategory>;

export const TechItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: TechCategory,
  notes: z.string().optional(),
  link: z.string().url().optional(),
  addedAt: z.string().datetime(),
});
export type TechItem = z.infer<typeof TechItemSchema>;

export const CheckpointId = z.enum([
  "system_surface",
  "device_fabric",
  "sensory_language",
  "contextual_interweave",
  "paradigm_moment",
]);
export type CheckpointId = z.infer<typeof CheckpointId>;

export const CheckpointSchema = z.object({
  id: CheckpointId,
  status: z.enum(["planned", "in_progress", "done"]).default("planned"),
  evidence: z.array(z.string()).default([]),
  updatedAt: z.string().datetime(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const GoalSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  area: z
    .enum(["native", "orchestration", "ux", "infra", "research"])
    .default("native"),
  targetDate: z.string().datetime().optional(),
  status: z.enum(["planned", "in_progress", "done"]).default("planned"),
  createdAt: z.string().datetime(),
});
export type Goal = z.infer<typeof GoalSchema>;

/* ---------- Whole state ---------- */
export const OrganicStateSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    name: z.string(),
    org: z.string().default("Coalescence Labs"),
  }),
  keyInsights: z.array(InsightSchema),
  techStack: z.array(TechItemSchema),
  goals: z.array(GoalSchema),
  checkpoints: z.array(CheckpointSchema),
  lastUpdated: z.string().datetime(),
});
export type OrganicState = z.infer<typeof OrganicStateSchema>;

/* ---------- Defaults ---------- */
export const defaultOrganicState = (): OrganicState => {
  const now = new Date().toISOString();

  return {
    version: 1,
    profile: { name: "Alex Joshua", org: "Coalescence Labs" },
    keyInsights: [],
    techStack: [],
    goals: [],
    checkpoints: [
      { id: "system_surface", status: "planned", evidence: [], updatedAt: now },
      { id: "device_fabric", status: "planned", evidence: [], updatedAt: now },
      {
        id: "sensory_language",
        status: "planned",
        evidence: [],
        updatedAt: now,
      },
      {
        id: "contextual_interweave",
        status: "planned",
        evidence: [],
        updatedAt: now,
      },
      {
        id: "paradigm_moment",
        status: "planned",
        evidence: [],
        updatedAt: now,
      },
    ],
    lastUpdated: now,
  };
};

import { z } from "zod";

import { AGENT_RUNTIME_ROLES } from "@/lib/llm/subagents/roles";

export const AgentRuntimeRoleSchema = z.enum(AGENT_RUNTIME_ROLES);

export const SubagentIdentitySchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  /** Domain/display role (researcher, coder, …) — not the runtime role. */
  displayRole: z.string().min(1),
  runtimeRole: AgentRuntimeRoleSchema,
  /** Surface keywords for the abstract identity mark (form, material, light). */
  surfaceTraits: z.array(z.string().min(1)).min(1).max(8),
});

export type SubagentIdentity = z.infer<typeof SubagentIdentitySchema>;

export const WorkerGoalSchema = z.object({
  goalId: z.string().min(1),
  agentId: z.string().min(1),
  goal: z.string().min(1),
  assignedAt: z.number().int().nonnegative(),
  orchestratorId: z.string().min(1),
});

export type WorkerGoal = z.infer<typeof WorkerGoalSchema>;

export const WorkerMilestoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  at: z.number().int().nonnegative(),
});

export type WorkerMilestone = z.infer<typeof WorkerMilestoneSchema>;

export const WorkerProgressEventSchema = z.object({
  kind: z.literal("progress"),
  goalId: z.string().min(1),
  agentId: z.string().min(1),
  narrative: z.string().min(1),
  progressPct: z.number().min(0).max(100),
  at: z.number().int().nonnegative(),
  /** When set, the shell should adopt this as the agent's current goal. */
  assignedGoal: z.string().min(1).optional(),
});

export const WorkerMilestoneEventSchema = z.object({
  kind: z.literal("milestone"),
  goalId: z.string().min(1),
  agentId: z.string().min(1),
  milestone: WorkerMilestoneSchema,
  at: z.number().int().nonnegative(),
});

export const WorkerCompletionEventSchema = z.object({
  kind: z.literal("completion"),
  goalId: z.string().min(1),
  agentId: z.string().min(1),
  summary: z.string().min(1),
  at: z.number().int().nonnegative(),
});

export const WorkerFailureEventSchema = z.object({
  kind: z.literal("failure"),
  goalId: z.string().min(1),
  agentId: z.string().min(1),
  /** Short card-facing error — never a fake near-done percent. */
  error: z.string().min(1).max(280),
  at: z.number().int().nonnegative(),
});

export const WorkerAwarenessEventSchema = z.discriminatedUnion("kind", [
  WorkerProgressEventSchema,
  WorkerMilestoneEventSchema,
  WorkerCompletionEventSchema,
  WorkerFailureEventSchema,
]);

export type WorkerAwarenessEvent = z.infer<typeof WorkerAwarenessEventSchema>;

export const SubagentIdentityImageRecordSchema = z.object({
  agentId: z.string().min(1),
  /** Public or app-served URL for the stored mark. */
  url: z.string().min(1),
  mediaType: z.string().min(1),
  prompt: z.string().min(1),
  createdAt: z.string().min(1),
  storageKey: z.string().min(1),
});

export type SubagentIdentityImageRecord = z.infer<
  typeof SubagentIdentityImageRecordSchema
>;

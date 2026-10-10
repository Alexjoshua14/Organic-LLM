import { z } from "zod";

import type { WorkerGoal } from "@/lib/schemas/subagent-runtime";

import { CHAT_EXPERIENCES } from "@/lib/chat/chat-experience";
import { ChatEffortLevelSchema } from "@/lib/schemas/chat-effort";
import { ChatModelSchema } from "@/lib/schemas/chat";

const QueueExperienceSchema = z.enum(CHAT_EXPERIENCES);

export const MessageSendQueueStatusSchema = z.enum([
  "pending",
  "blocked_streaming",
  "blocked_budget",
  "dispatching",
  "sent",
  "failed",
  "cancelled",
]);

export type MessageSendQueueStatus = z.infer<typeof MessageSendQueueStatusSchema>;

/** Active / visible-to-user statuses (not yet finished). */
export const OPEN_QUEUE_STATUSES: MessageSendQueueStatus[] = [
  "pending",
  "blocked_streaming",
  "blocked_budget",
  "dispatching",
];

export const MessageSendQueuePayloadSchema = z.object({
  model: ChatModelSchema.optional(),
  effort: ChatEffortLevelSchema.optional(),
  webSearch: z.boolean().optional(),
  memory: z.boolean().optional(),
  speechFriendly: z.boolean().optional(),
  zeroDataRetention: z.boolean().optional(),
  experience: QueueExperienceSchema.optional(),
  messageSearch: z.boolean().optional(),
});

export type MessageSendQueuePayload = z.infer<typeof MessageSendQueuePayloadSchema>;

export const EnqueueMessageSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(100_000),
  targetAgentId: z.string().min(1).max(128).optional(),
  payload: MessageSendQueuePayloadSchema.optional(),
});

export type EnqueueMessageInput = z.infer<typeof EnqueueMessageSchema>;

export type MessageSendQueueRow = {
  id: string;
  owner_id: string;
  thread_id: string;
  target_agent_id: string | null;
  body: string;
  /** Internal heartbeat cause is never accepted by the public enqueue schema. */
  payload: MessageSendQueuePayload & { heartbeatMessageId?: string; subagentRun?: Omit<WorkerGoal, "goal"> & { modelId: string } };
  position: number;
  status: MessageSendQueueStatus;
  hold_reason: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  sent_at: string | null;
};

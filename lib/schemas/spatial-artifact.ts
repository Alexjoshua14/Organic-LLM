import { z } from "zod";

import { GenUIBlockSchema, type GenUIBlockType } from "@/lib/schemas/gen-ui";

export const SpatialArtifactSchema = z.object({
  id: z.string().min(1),
  block: GenUIBlockSchema,
  threadId: z.string().uuid(),
  threadTitle: z.string(),
  messageId: z.string(),
  toolCallId: z.string(),
  blockType: z.string(),
  createdAt: z.string(),
  pinned: z.boolean(),
  snapshotUpdatedAt: z.string().nullable(),
  stale: z.boolean(),
});

export type SpatialArtifact = z.infer<typeof SpatialArtifactSchema>;

export const SpatialArtifactRowSchema = z.object({
  id: z.string(),
  owner_id: z.string().uuid(),
  thread_id: z.string().uuid(),
  message_id: z.string(),
  tool_call_id: z.string(),
  block_type: z.string(),
  thread_title: z.string(),
  block_snapshot: GenUIBlockSchema.nullable(),
  snapshot_updated_at: z.string().nullable(),
  source_message_updated_at: z.string().nullable(),
  pinned: z.boolean(),
  pinned_at: z.string().nullable(),
  sync_lock_until: z.string().nullable(),
  created_at: z.string(),
});

export type SpatialArtifactRow = z.infer<typeof SpatialArtifactRowSchema>;

export type SpatialArtifactFilter = "all" | "pinned" | "plans" | "audio" | "guides";

export type ListSpatialArtifactsResult = {
  disabled?: boolean;
  artifacts: SpatialArtifact[];
};

export type PinSpatialArtifactInput = {
  coalescenceMode: boolean;
  threadId: string;
  messageId: string;
  toolCallId: string;
  block: z.infer<typeof GenUIBlockSchema>;
  threadTitle?: string;
};

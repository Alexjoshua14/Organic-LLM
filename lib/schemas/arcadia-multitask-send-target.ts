import { z } from "zod";

/**
 * Mirrors {@link ArcadiaMultitaskSendTarget} in `lib/arcadia/multitask/layout-mode.ts`.
 * Kept as Zod here so ChatRequest / queue payloads can validate the same shape.
 */
export const ArcadiaMultitaskSendTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("orchestrator") }),
  z.object({
    kind: z.literal("subagent"),
    agentId: z.string().min(1).max(128),
  }),
]);

export type ArcadiaMultitaskSendTargetParsed = z.infer<
  typeof ArcadiaMultitaskSendTargetSchema
>;

/** Default when the client omits the field — same as the dashboard default. */
export const DEFAULT_CHAT_MULTITASK_SEND_TARGET: ArcadiaMultitaskSendTargetParsed = {
  kind: "orchestrator",
};

export function resolveMultitaskSendTarget(
  value: ArcadiaMultitaskSendTargetParsed | null | undefined
): ArcadiaMultitaskSendTargetParsed {
  return value ?? DEFAULT_CHAT_MULTITASK_SEND_TARGET;
}

/** Map a queue row's `target_agent_id` into the send-target shape. */
export function sendTargetFromQueueAgentId(
  targetAgentId: string | null | undefined
): ArcadiaMultitaskSendTargetParsed {
  if (targetAgentId && targetAgentId.trim().length > 0) {
    return { kind: "subagent", agentId: targetAgentId.trim() };
  }

  return DEFAULT_CHAT_MULTITASK_SEND_TARGET;
}

/** Map a send target to the queue's optional `targetAgentId` column. */
export function queueAgentIdFromSendTarget(
  target: ArcadiaMultitaskSendTargetParsed | null | undefined
): string | undefined {
  const resolved = resolveMultitaskSendTarget(target);

  return resolved.kind === "subagent" ? resolved.agentId : undefined;
}

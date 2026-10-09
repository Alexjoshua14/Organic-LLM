import type { LanguageModelUsage, UIMessage } from "ai";
import type { SubagentThreadSnapshot } from "@/lib/llm/subagents/threads/snapshot";

import { randomUUID } from "crypto";

import { z } from "zod";

import {
  jevRouterCallConfig,
  type JevZdrProviderOptions,
} from "@/lib/llm/subagents/orchestrator/router-zdr";
import { gatewayAttribution } from "@/lib/usage/gateway-attribution";

export const SubagentHeartbeatEventSchema = z.object({
  threadId: z.string().min(1),
  agentId: z.string().min(1),
  whatHappened: z.string().min(1).max(400),
  nextSteps: z.string().min(1).max(400),
});

export type SubagentHeartbeatEvent = z.infer<typeof SubagentHeartbeatEventSchema> & {
  name: string;
  role: string;
};

export const SubagentHeartbeatDecisionSchema = z.object({
  notable: z.boolean(),
  events: z.array(SubagentHeartbeatEventSchema).max(8),
});

export type SubagentHeartbeatDecision = {
  notable: boolean;
  events: SubagentHeartbeatEvent[];
};

export type JevHeartbeatGenerate = (args: {
  model: string;
  question: string;
  prompt: string;
  providerOptions: JevZdrProviderOptions;
  schema: typeof SubagentHeartbeatDecisionSchema;
}) => Promise<{
  object: z.infer<typeof SubagentHeartbeatDecisionSchema>;
  usage?: LanguageModelUsage;
  providerMetadata?: unknown;
}>;

export const JEV_HEARTBEAT_QUESTION = `You are Organic LLM's heartbeat gate for an orchestrator agent.
You see each subagent thread twice: PREVIOUS is its state the last time you flagged a change (empty means never), CURRENT is now.

Count as notable when something changed that the orchestrator should know about or act on:
- a subagent finished and produced a new outcome
- a subagent failed or stalled (status blocked)
- a result needs a decision, or the subagent asked a question
- the user gave a subagent a new request directly in its thread

Do not count as notable:
- no change, only timestamps moved,
- a subagent still working with no new output,
- or a reworded version of the same result.

Is there a new change the orchestrator should know about or act on?`;

function formatSnapshots(snapshots: ReadonlyArray<SubagentThreadSnapshot>): string {
  if (snapshots.length === 0) return "(empty)";

  return snapshots
    .map((s) =>
      [
        `- threadId=${s.threadId} agentId=${s.agentId} ${s.name} (${s.role}) status=${s.status}`,
        `  assignment: ${s.lastGoal ?? "(none)"}`,
        `  outcome: ${s.lastOutcome ?? "(none)"}`,
      ].join("\n")
    )
    .join("\n");
}

export function buildHeartbeatPrompt(args: {
  previous: ReadonlyArray<SubagentThreadSnapshot>;
  current: ReadonlyArray<SubagentThreadSnapshot>;
}): string {
  return [
    "PREVIOUS:",
    formatSnapshots(args.previous),
    "",
    "CURRENT:",
    formatSnapshots(args.current),
  ].join("\n");
}

/**
 * Keep only events about threads that exist now, with identity taken from the snapshot rather
 * than the model. A `notable` with nothing left is not notable.
 */
export function normalizeHeartbeatDecision(
  raw: z.infer<typeof SubagentHeartbeatDecisionSchema>,
  current: ReadonlyArray<SubagentThreadSnapshot>
): SubagentHeartbeatDecision {
  const byThread = new Map(current.map((s) => [s.threadId, s]));
  const events = raw.notable
    ? raw.events.flatMap((event) => {
        const snapshot = byThread.get(event.threadId);

        if (!snapshot) return [];

        return [
          {
            threadId: snapshot.threadId,
            agentId: snapshot.agentId,
            name: snapshot.name,
            role: snapshot.role,
            whatHappened: event.whatHappened.trim(),
            nextSteps: event.nextSteps.trim(),
          },
        ];
      })
    : [];

  return { notable: events.length > 0, events };
}

const defaultGenerate: JevHeartbeatGenerate = async (args) => {
  return { object: { notable: false, events: [] }, usage: undefined, providerMetadata: undefined };

  // const result = await decide({
  //   model: args.model,
  //   state: args.prompt,
  //   questions: {
  //     refunded: {
  //       type: 'boolean',
  //       instructions: args.question,
  //     },
  //   },
  // })


  // const result = await generateObject({
  //   model: args.model,
  //   system: args.system,
  //   prompt: args.prompt,
  //   schema: args.schema,
  //   providerOptions: args.providerOptions,
  //   maxOutputTokens: 1200,
  //   abortSignal: AbortSignal.timeout(15_000),
  // });

  //return { object: result.object, usage: result.usage, providerMetadata: result.providerMetadata };
};

/**
 * The heartbeat's intelligent if-branch: Jev (ZDR forced, never optional) decides whether the
 * board moved enough since it last fired to interrupt the orchestrator.
 */
export async function evaluateSubagentHeartbeat(args: {
  previous: ReadonlyArray<SubagentThreadSnapshot>;
  current: ReadonlyArray<SubagentThreadSnapshot>;
  ownerId: string;
  generate?: JevHeartbeatGenerate;
}): Promise<{
  decision: SubagentHeartbeatDecision;
  modelId: string;
  usage?: LanguageModelUsage;
  providerMetadata?: unknown;
}> {
  const call = jevRouterCallConfig();
  const providerOptions: JevZdrProviderOptions = {
    gateway: {
      ...call.providerOptions.gateway,
      ...gatewayAttribution({ userId: args.ownerId, operation: "subagent_heartbeat" }),
    },
  };

  if (providerOptions.gateway.zeroDataRetention !== true) {
    throw new Error("Jev heartbeat refused: ZDR must be on");
  }

  const result = await (args.generate ?? defaultGenerate)({
    model: call.model,
    question: JEV_HEARTBEAT_QUESTION,
    prompt: buildHeartbeatPrompt(args),
    providerOptions,
    schema: SubagentHeartbeatDecisionSchema,
  });

  return {
    decision: normalizeHeartbeatDecision(result.object, args.current),
    modelId: call.model,
    usage: result.usage,
    providerMetadata: result.providerMetadata,
  };
}

export const SUBAGENT_HEARTBEAT_MESSAGE_KIND = "subagent-heartbeat";

export type SubagentHeartbeatMessageMetadata = {
  kind: typeof SUBAGENT_HEARTBEAT_MESSAGE_KIND;
  at: number;
  events: SubagentHeartbeatEvent[];
};

export function isSubagentHeartbeatMetadata(
  metadata: unknown
): metadata is SubagentHeartbeatMessageMetadata {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    (metadata as { kind?: unknown }).kind === SUBAGENT_HEARTBEAT_MESSAGE_KIND &&
    Array.isArray((metadata as { events?: unknown }).events)
  );
}

/** The system row posted into the orchestrator's thread when the heartbeat fires true. */
export function buildHeartbeatSystemMessage(args: {
  events: ReadonlyArray<SubagentHeartbeatEvent>;
  at: number;
  id?: string;
}): UIMessage<SubagentHeartbeatMessageMetadata> {
  const lines = args.events.map((e) =>
    [
      `• ${e.name} (${e.role}) — thread ${e.threadId}`,
      `  What happened: ${e.whatHappened}`,
      `  Next steps for the orchestrator: ${e.nextSteps}`,
    ].join("\n")
  );

  return {
    id: args.id ?? randomUUID(),
    role: "system",
    metadata: { kind: SUBAGENT_HEARTBEAT_MESSAGE_KIND, at: args.at, events: [...args.events] },
    parts: [{ type: "text", text: ["Subagent update", ...lines].join("\n") }],
  };
}

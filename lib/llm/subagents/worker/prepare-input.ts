import type { ModelMessage, ToolSet, UIMessage } from "ai";
import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";

import { asSchema, convertToModelMessages } from "ai";

import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";
import { buildLockedWorkerSystem } from "@/lib/llm/subagents/hard-set/shell";
import { buildWorkerSystem } from "./run-with-model";
import { SUBAGENT_MAX_INPUT_TOKENS } from "./cost-limits";
import { foldSystemNoticesForModel } from "../threads/fold-system-notices";
import {
  CONTEXT_DATA_INSTRUCTIONS,
  createReadContextItemTool,
  readSubagentContext,
} from "../threads/context-items";

export const SUBAGENT_THREAD_CONTEXT_MESSAGES = 30;
export const SUBAGENT_TOOL_HEADROOM_TOKENS = 4_000;

export type WorkerInputBudget = {
  estimatedInputTokens: number;
  inputLimitTokens: number;
  reservedToolTokens: number;
  instructionsTokens: number;
  toolSchemaTokens: number;
  messagesTokens: number;
  inputCostEstimateUsd: { uncached: number; fullyCached: number };
};

export type WorkerInputInspection = { fits: boolean; budget: WorkerInputBudget };
export type WorkerInputRequest = {
  assignment: UIMessage;
  history: UIMessage[];
  threadId: string;
  modelId: string;
  agentId: string;
};

export type PreparedWorkerTools = {
  tools: ToolSet;
  instructions: string;
  toolSchemaText: string;
  research: boolean;
  budget: WorkerInputBudget;
};

export function buildSubagentThreadSystem(name?: string, role?: string): string {
  return [
    buildWorkerSystem(name, role),
    "This thread is yours alone: it holds your assignments and replies. You cannot see the",
    "orchestrator's thread or other subagents' threads. Messages marked “From the orchestrator”",
    "are assignments; other user messages are the user talking to you directly.",
  ].join(" ");
}

export function estimateWorkerInput(args: {
  instructions: string;
  toolSchemaText: string;
  messages: ModelMessage[];
  modelId: string;
}): WorkerInputInspection {
  const messagesText = JSON.stringify(args.messages);
  const estimatedInputTokens = estimateTokenCountSync(
    `${args.instructions}\n${args.toolSchemaText}\n${messagesText}`
  );
  const budget: WorkerInputBudget = {
    estimatedInputTokens,
    inputLimitTokens: SUBAGENT_MAX_INPUT_TOKENS,
    reservedToolTokens: SUBAGENT_TOOL_HEADROOM_TOKENS,
    instructionsTokens: estimateTokenCountSync(args.instructions),
    toolSchemaTokens: estimateTokenCountSync(args.toolSchemaText),
    messagesTokens: estimateTokenCountSync(messagesText),
    inputCostEstimateUsd: {
      uncached: computeUsageCostUsd(args.modelId, {
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        cachedInputTokens: 0,
      }),
      fullyCached: computeUsageCostUsd(args.modelId, {
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        cachedInputTokens: estimatedInputTokens,
      }),
    },
  };
  return {
    fits: estimatedInputTokens + SUBAGENT_TOOL_HEADROOM_TOKENS <= SUBAGENT_MAX_INPUT_TOKENS,
    budget,
  };
}

/** Shared by dispatch preflight and execution; no model call or source fetch is performed. */
export async function prepareWorkerTools(args: {
  chatId: string;
  sbUserId: string;
  model: string;
  system: string;
  messages: ModelMessage[];
  initialMessageCount: number;
  toolPolicy?: HardSetSubagent["tools"];
  assignment?: UIMessage;
}): Promise<PreparedWorkerTools> {
  const policy = args.toolPolicy;
  const compiled = await compileChatTools({
    useSearch: policy?.webSearch ?? true,
    useResearch: policy?.research ?? false,
    researchModelId: args.model,
    researchGenerationContext: { messages: args.messages, system: args.system },
    useMemory: policy?.memory ?? false,
    useGetMoreMessages: policy?.chatHistory ?? true,
    useKnowledgeSearch: false,
    experience: "arcadia",
    chatId: args.chatId,
    sbUserId: args.sbUserId,
    initialMessageCount: args.initialMessageCount,
  });
  const tools = { ...compiled.tools };
  if (args.assignment) {
    const items = readSubagentContext(args.assignment)?.items ?? [];
    tools.read_context_item = createReadContextItemTool(async () => items);
  }
  const instructions = [
    args.system,
    compiled.toolInstructions,
    args.assignment ? CONTEXT_DATA_INSTRUCTIONS : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const toolSchemaText = JSON.stringify(
    await Promise.all(
      Object.entries(tools).map(async ([name, definition]) => ({
        name,
        description: definition.description,
        schema: await asSchema(definition.inputSchema).jsonSchema,
      }))
    )
  );
  return {
    tools,
    instructions,
    toolSchemaText,
    research: policy?.research === true,
    budget: estimateWorkerInput({
      instructions,
      toolSchemaText,
      messages: args.messages,
      modelId: args.model,
    }).budget,
  };
}

export async function workerModelMessages(history: UIMessage[], assignment: UIMessage) {
  return convertToModelMessages(foldSystemNoticesForModel([...history, assignment]), {
    ignoreIncompleteToolCalls: true,
  });
}

export async function inspectWorkerInput(
  args: WorkerInputRequest & {
    ownerId: string;
    workerName?: string;
    workerRole?: string;
    lockedPersona?: HardSetSubagent;
  }
): Promise<WorkerInputInspection> {
  const system = args.lockedPersona
    ? buildLockedWorkerSystem(args.lockedPersona)
    : buildSubagentThreadSystem(args.workerName, args.workerRole);
  const messages = await workerModelMessages(args.history, args.assignment);
  const prepared = await prepareWorkerTools({
    chatId: args.threadId,
    sbUserId: args.ownerId,
    model: args.modelId,
    system,
    messages,
    initialMessageCount: args.history.length + 1,
    toolPolicy: args.lockedPersona?.tools,
    assignment: args.assignment,
  });
  return estimateWorkerInput({
    instructions: prepared.instructions,
    toolSchemaText: prepared.toolSchemaText,
    messages,
    modelId: args.modelId,
  });
}

/** Stable chronological history: continue preserves the prefix; selection is explicit. */
export function selectWorkerHistory(
  history: UIMessage[],
  mode: "continue" | "fresh" = "continue",
  messageIds?: string[]
) {
  if (mode === "fresh") {
    if (messageIds?.length) throw new Error("Fresh history cannot also select previous messages.");
    return { messages: [], selection: { mode: "fresh" as const, messageIds: [] } };
  }
  if (messageIds) {
    if (messageIds.some((id) => !history.some((message) => message.id === id)))
      throw new Error(
        "A selected history message is unavailable in this subagent's recent thread. Read its thread and select available IDs."
      );
    const selected = new Set(messageIds);
    const messages = history.filter((message) => selected.has(message.id));
    return {
      messages,
      selection: { mode: "selected" as const, messageIds: messages.map((message) => message.id) },
    };
  }
  return {
    messages: history,
    selection: { mode: "continue" as const, messageIds: history.map((message) => message.id) },
  };
}

import { describe, expect, test } from "bun:test";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { createErgonTicketTools } from "@/lib/llm/ergon-ticket-tools";
import { createOrchestratorTools } from "@/lib/llm/subagents/orchestrator/orchestrator-tools";

// Anthropic's compilation budget is request-wide. Count oneOf too, conservatively,
// because providers can normalize discriminated unions before compiling them.
function unionCount(schema: unknown): number {
  if (!schema || typeof schema !== "object") return 0;
  if (Array.isArray(schema)) return schema.reduce((sum, child) => sum + unionCount(child), 0);
  const node = schema as Record<string, unknown>;
  const union = Array.isArray(node.type) || Array.isArray(node.anyOf) || Array.isArray(node.oneOf);

  return (
    Number(union) + Object.values(node).reduce<number>((sum, child) => sum + unionCount(child), 0)
  );
}

describe("chat tool schema compilation budget", () => {
  for (const chatStyle of [undefined, "ergon", "remy"] as const) {
    test(`serialized Arcadia ${chatStyle ?? "default"} tools stay under the union limit with tickets and orchestration`, async () => {
      const compiled = await compileChatTools({
        experience: "arcadia",
        chatStyle,
        useMemory: true,
        useSearch: true,
        useGetMoreMessages: true,
        chatId: "synthetic-thread",
        initialMessageCount: 1,
        sbUserId: "synthetic-owner",
      });
      const unused = async () => {
        throw new Error("Schema checks must not execute tools");
      };
      const ticketTools = await createErgonTicketTools("synthetic-owner", {
        env: {
          ERGON_URL: "https://ergon.example.com",
          ERGON_TOKEN: "test-only",
          ERGON_OWNER_PROFILE_ID: "synthetic-owner",
        },
        loadConnection: async () => null,
        resolveToken: async () => null,
        fetch: unused,
      });
      const tools = {
        ...compiled.tools,
        ...ticketTools,
        ...createOrchestratorTools({
          orchestratorThreadId: "synthetic-thread",
          modelId: "synthetic-model",
          zeroDataRetention: true,
          autonomous: false,
          worktable: null,
          deps: {
            listChildren: unused,
            loadMessages: unused,
            ensureChild: unused,
            appendMessages: unused,
            setStatus: unused,
            enqueueWorker: unused,
          },
        }),
      };
      // Exercise the SDK's actual tool serialization without a network request or tool call.
      const model = new MockLanguageModelV4({
        doGenerate: {
          content: [{ type: "text", text: "OK" }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
          warnings: [],
        },
      });

      await generateText({ model, tools, prompt: "Synthetic schema check", toolChoice: "none" });
      const sent = model.doGenerateCalls[0].tools!;
      const schemas = sent.flatMap((definition) =>
        definition.type === "function"
          ? [{ name: definition.name, schema: definition.inputSchema }]
          : []
      );
      const counts = schemas.map(({ name, schema }) => ({ name, unions: unionCount(schema) }));

      expect(schemas.some(({ name }) => name === "ergon_save_issue")).toBe(true);
      expect(schemas.some(({ name }) => name === "render_gen_ui")).toBe(true);
      expect(schemas.some(({ name }) => name === "dispatch_subagent")).toBe(true);
      expect(counts.reduce((sum, { unions }) => sum + unions, 0)).toBeLessThanOrEqual(16);
    });
  }
});

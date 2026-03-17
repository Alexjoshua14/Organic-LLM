/**
 * Loaded before tests so mocks are applied before any test file imports.
 * - Mocks Redis/Upstash so no network in CI; lib/rate-limit/llm gets mocked deps.
 * - Loads real rabbitholes once so tests can spread it in partial mocks (avoids
 *   "advanceGenerationStep is undefined" when other files mock rabbitholes).
 */
import { mock } from "bun:test";

declare global {
  // eslint-disable-next-line no-var
  var __realRabbitholes: typeof import("@/data/supabase/rabbitholes");
  // Set by runGenerationAndPersist.test to control runOneGenerationStep (preload mocks actions so real module never loads in CI)
  // eslint-disable-next-line no-var
  var __runOneGenerationStepHandler: (typeof import("@/lib/rabbit-holes/actions"))["runOneGenerationStep"] | undefined;
}

mock.module("server-only", () => ({}));
mock.module("@/lib/supabase/server", () => ({
  supabaseServer: async () =>
    ({
      from: () => ({
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }) as never,
}));

// Prevent any test from loading real Redis (avoids "fetch() URL is invalid" in CI).
// Do not mock @upstash/ratelimit here so llm-rate-limit.test's mock (with mockLimit) is
// used when lib/rate-limit/llm loads; that test runs first (00-llm-rate-limit.test.ts).
mock.module("@upstash/redis", () => ({
  Redis: class {
    request = () => Promise.resolve({ data: undefined, error: null });
  },
}));
mock.module("@/lib/redis/redis", () => ({ redis: {} }));

// Mock chat-store so the real "use server" module is never loaded in tests (Bun fails with "Export named 'createChat' not found"). Integration tests replace this with their own full mocks.
const chatStoreStub = async () => ({ data: null, error: new Error("chat-store mocked") });
mock.module("@/lib/chat/chat-store", () => ({
  createChat: chatStoreStub,
  loadChat: chatStoreStub,
  readChat: chatStoreStub,
  saveChat: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  saveMessage: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  deleteChatMessage: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  getChats: async () => ({ data: null, error: new Error("chat-store mocked") }),
  getChat: chatStoreStub,
  getContext: async () => ({ data: null, error: "chat-store mocked" }),
  getContextAndMessagesChatPrompt: async () => ({ data: null, error: "chat-store mocked" }),
  getMessagesForChatPrompt: async () => ({ data: null, error: "chat-store mocked" }),
}));

// Mock the runOneGenerationStep barrel so runGenerationAndPersist never loads actions.ts ("use server"); CI fails with "Export named 'runOneGenerationStep' not found" when the real file is loaded. Tests override via globalThis.__runOneGenerationStepHandler.
mock.module("@/lib/rabbit-holes/runOneGenerationStep", () => ({
  runOneGenerationStep: (async (...args: unknown[]) => {
    const fn = globalThis.__runOneGenerationStepHandler;
    return fn ? (fn as (...a: unknown[]) => Promise<unknown>)(...args) : { data: null, error: new Error("mocked") };
  }) as never,
}));
// Mock actions for any test that imports it directly (e.g. useRabbitHoles).
mock.module("@/lib/rabbit-holes/actions", () => ({
  runOneGenerationStep: (async (...args: unknown[]) => {
    const fn = globalThis.__runOneGenerationStepHandler;
    return fn ? (fn as (...a: unknown[]) => Promise<unknown>)(...args) : { data: null, error: new Error("mocked") };
  }) as never,
  generateQuickPreview: async () => ({ data: null, error: null }),
  analyzeSource: async () => ({ data: null, error: null }),
  generateRabbitHoleNode: async () => ({ data: null, error: new Error("mocked") }),
}));

// Load real rabbitholes once (after supabase mock) so tests can use it in partial mocks
const rabbitholes = await import("@/data/supabase/rabbitholes");
globalThis.__realRabbitholes = rabbitholes;

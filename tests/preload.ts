/**
 * Loaded before tests so mocks are applied before any test file imports.
 * - Mocks Redis/Upstash so no network in CI; lib/rate-limit/llm gets mocked deps.
 * - Provides safe defaults for server-action modules that Bun cannot load in tests.
 */
import { mock } from "bun:test";

process.env.EXA_API_KEY = process.env.EXA_API_KEY ?? "test-exa-key";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key";

import { registerUpstashRateLimitMocks } from "./helpers/rate-limit-upstash";

declare global {
  // eslint-disable-next-line no-var
  var __realChat: typeof import("@/data/supabase/chat");
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

// Single Upstash ratelimit + redis mock for unit tests (00-llm-rate-limit + chats-rate-limit
// must not register competing mock.module — last file wins).
registerUpstashRateLimitMocks();

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

// Mock the runOneGenerationStep barrel so runGenerationAndPersist never loads actions.ts
// ("use server"); CI fails with "Export named 'runOneGenerationStep' not found" when
// the real file is loaded. Tests that need custom behavior replace and restore this module.
mock.module("@/lib/rabbit-holes/runOneGenerationStep", () => ({
  runOneGenerationStep: async () => ({ data: null, error: new Error("mocked") }),
}));
// Mock actions for any test that imports it directly (e.g. useRabbitHoles).
mock.module("@/lib/rabbit-holes/actions", () => ({
  runOneGenerationStep: async () => ({ data: null, error: new Error("mocked") }),
  generateQuickPreview: async () => ({ data: null, error: null }),
  analyzeSource: async () => ({ data: null, error: null }),
  generateRabbitHoleNode: async () => ({ data: null, error: new Error("mocked") }),
}));

// Same for chat — partial mocks must spread these exports or later files break on `loadChat`.
const chatModule = await import("@/data/supabase/chat");
globalThis.__realChat = chatModule;

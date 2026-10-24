import type { GatewayProviderOptions } from "@ai-sdk/gateway";

/** ZDR for all Knowledge feature LLM calls (AI Gateway). Same shape as `PROVIDER_OPTIONS` in profile-generation. */
export const KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS = {
  gateway: {
    zeroDataRetention: true,
  } satisfies GatewayProviderOptions,
} as const;

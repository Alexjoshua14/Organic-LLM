import type { GatewayProviderOptions } from "@ai-sdk/gateway";

import { models } from "@/lib/schemas/chat-models";
import type { ChatModel } from "@/lib/schemas/chat-models";

/**
 * Mandatory zero-data-retention for the multi-thought orchestrator router.
 * Same AI Gateway shape as Knowledge / profile-generation — not optional on this path.
 * User settings cannot turn this off for Jev.
 */
export const ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS = {
  gateway: {
    zeroDataRetention: true,
  } satisfies GatewayProviderOptions,
} as const;

/**
 * Gateway options for any Jev call: ZDR pinned to `true`, plus optional attribution
 * (`user`, `tags`) so the Gateway spend report can group Jev cost by owner and operation.
 */
export type JevZdrProviderOptions = {
  gateway: Pick<GatewayProviderOptions, "user" | "tags"> & { zeroDataRetention: true };
};

/** Catalog row for the house routing model (picker: false, ZDR required). */
export const JEV_CHAT_MODEL: ChatModel = models.typesafe.jev;

/** Gateway id — house style `typesafe-ai/jev`. */
export const JEV_GATEWAY_MODEL_ID = JEV_CHAT_MODEL.id;

/** @deprecated Prefer {@link JEV_GATEWAY_MODEL_ID}; kept for older imports. */
export const INTENDED_ORCHESTRATOR_ROUTER_MODEL_ID = JEV_GATEWAY_MODEL_ID;

/**
 * Compile-time + runtime guard: Jev must advertise mandatory ZDR.
 * Call sites that build a Jev request should go through {@link jevRouterCallConfig}.
 */
export function assertJevRequiresZdr(model: ChatModel = JEV_CHAT_MODEL): void {
  if (model.id !== JEV_GATEWAY_MODEL_ID) {
    throw new Error(`Expected Jev catalog id ${JEV_GATEWAY_MODEL_ID}, got ${model.id}`);
  }
  if (model.supportsZeroDataRetention !== true) {
    throw new Error("Jev must support zero data retention");
  }
  if (model.requiresZeroDataRetention !== true) {
    throw new Error("Jev requires mandatory zero data retention on every call");
  }
}

/**
 * The only sanctioned way to configure a Jev generate* call: model id + forced ZDR.
 * Spreading these into `generateObject` / `generateText` keeps ZDR on the request.
 */
export function jevRouterCallConfig(): {
  model: typeof JEV_GATEWAY_MODEL_ID;
  providerOptions: typeof ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS;
  zeroDataRetention: true;
} {
  assertJevRequiresZdr();

  return {
    model: JEV_GATEWAY_MODEL_ID,
    providerOptions: ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS,
    zeroDataRetention: true,
  };
}

import "server-only";

import type { IntrospectionGuidedState, IntrospectionStoredConfig } from "@/lib/schemas/introspection";

import { supabaseServer } from "@/lib/supabase/server";
import { encryptForStorage, decryptFromStorage } from "@/lib/crypto/message-encryption";
import {
  IntrospectionGuidedStateSchema,
  buildInitialGuidedState,
} from "@/lib/schemas/introspection";
import { SimpleResult } from "@/types";

function configContext(userId: string, threadId: string) {
  return {
    userId,
    threadId,
    fieldName: "threads.introspection_config" as const,
  };
}

function guidedStateContext(userId: string, threadId: string) {
  return {
    userId,
    threadId,
    fieldName: "threads.introspection_guided_state" as const,
  };
}

export async function introspectionNonceAlreadyUsed(nonce: string): Promise<boolean> {
  const sb = await supabaseServer();
  const { count, error } = await sb
    .from("threads")
    .select("id", { count: "exact", head: true })
    .eq("introspection_bootstrap_nonce", nonce);

  if (error) {
    throw new Error(error.message ?? "Failed to check introspection nonce");
  }

  return (count ?? 0) > 0;
}

export async function saveIntrospectionBootstrap(
  threadId: string,
  userId: string,
  config: IntrospectionStoredConfig
): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const guidedState = buildInitialGuidedState(config);
  const configJson = JSON.stringify({
    systemInstructions: config.systemInstructions,
    title: config.title,
    goal: config.goal,
    steps: config.steps,
    initialOverview: config.initialOverview,
    bootstrapNonce: config.bootstrapNonce,
  });
  const guidedJson = JSON.stringify(guidedState);

  const { error } = await sb
    .from("threads")
    .update({
      introspection_config_ciphertext: encryptForStorage(configJson, configContext(userId, threadId)),
      introspection_guided_state_ciphertext: encryptForStorage(
        guidedJson,
        guidedStateContext(userId, threadId)
      ),
      introspection_bootstrap_nonce: config.bootstrapNonce,
    })
    .eq("id", threadId);

  if (error) {
    return { ok: false, error: new Error(error.message ?? "Unknown error") };
  }

  return { ok: true, error: null };
}

/** Server-only: loads hidden orchestration config. Never expose to client. */
export async function loadIntrospectionConfig(
  threadId: string,
  userId: string
): Promise<IntrospectionStoredConfig | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select("introspection_config_ciphertext")
    .eq("id", threadId)
    .maybeSingle();

  if (error || !data?.introspection_config_ciphertext) {
    return null;
  }

  const raw = decryptFromStorage(
    data.introspection_config_ciphertext,
    configContext(userId, threadId)
  );
  const parsed = JSON.parse(raw) as IntrospectionStoredConfig;

  return parsed;
}

/** Public guided state safe for client hydration. */
export async function loadIntrospectionGuidedState(
  threadId: string,
  userId: string
): Promise<IntrospectionGuidedState | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select("introspection_guided_state_ciphertext")
    .eq("id", threadId)
    .maybeSingle();

  if (error || !data?.introspection_guided_state_ciphertext) {
    return null;
  }

  const raw = decryptFromStorage(
    data.introspection_guided_state_ciphertext,
    guidedStateContext(userId, threadId)
  );

  return IntrospectionGuidedStateSchema.parse(JSON.parse(raw));
}

export async function saveIntrospectionGuidedState(
  threadId: string,
  userId: string,
  state: IntrospectionGuidedState
): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const parsed = IntrospectionGuidedStateSchema.parse(state);
  const { error } = await sb
    .from("threads")
    .update({
      introspection_guided_state_ciphertext: encryptForStorage(
        JSON.stringify(parsed),
        guidedStateContext(userId, threadId)
      ),
    })
    .eq("id", threadId);

  if (error) {
    return { ok: false, error: new Error(error.message ?? "Unknown error") };
  }

  return { ok: true, error: null };
}

export async function getThreadFeature(
  threadId: string
): Promise<{ feature: string | null; path: string | null } | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select("feature, path")
    .eq("id", threadId)
    .maybeSingle();

  if (error || !data) return null;

  return { feature: data.feature ?? null, path: data.path ?? null };
}

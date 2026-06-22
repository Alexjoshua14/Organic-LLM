import "server-only";

import { z } from "zod";

import { createChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
import {
  introspectionNonceAlreadyUsed,
  saveIntrospectionBootstrap,
} from "@/data/supabase/introspection";
import { IntrospectionBootstrapWireRequestSchema } from "@/lib/organic-relay/schemas";
import { decryptBootstrapPayload } from "@/lib/organic-relay/crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/introspection/bootstrap.ts");

export const IntrospectionBootstrapRequestSchema = IntrospectionBootstrapWireRequestSchema;

export type IntrospectionBootstrapResult =
  | { ok: true; threadId: string; path: string }
  | { ok: false; error: string; status: number };

export async function bootstrapIntrospectionSession(
  wirePayload: string,
  sbUserId: string
): Promise<IntrospectionBootstrapResult> {
  let parsed;

  try {
    parsed = decryptBootstrapPayload(wirePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";

    logger.warn("bootstrap", "decrypt failed", { message });

    return { ok: false, error: message, status: 400 };
  }

  if (await introspectionNonceAlreadyUsed(parsed.nonce)) {
    return { ok: false, error: "Bootstrap nonce already used", status: 409 };
  }

  const createRes = await createChat();

  if (createRes.error || createRes.data === null) {
    logger.error("bootstrap", createRes.error?.message ?? "createChat failed");

    return { ok: false, error: "Failed to create session", status: 500 };
  }

  const threadId = createRes.data;
  const path = `/introspection/${threadId}`;
  const routingRes = await updateThreadRouting(threadId, {
    feature: "introspection",
    path,
  });

  if (!routingRes.ok) {
    logger.error("bootstrap", "updateThreadRouting failed");

    return { ok: false, error: "Failed to configure session routing", status: 500 };
  }

  const saveRes = await saveIntrospectionBootstrap(threadId, sbUserId, {
    systemInstructions: parsed.systemInstructions,
    title: parsed.title,
    goal: parsed.goal,
    steps: parsed.steps,
    initialOverview: parsed.initialOverview,
    bootstrapNonce: parsed.nonce,
  });

  if (!saveRes.ok) {
    logger.error("bootstrap", saveRes.error?.message ?? "saveIntrospectionBootstrap failed");

    return { ok: false, error: "Failed to persist session config", status: 500 };
  }

  if (parsed.title) {
    const { updateChatTitle } = await import("@/data/supabase/chat");

    await updateChatTitle(threadId, parsed.title).catch(() => undefined);
  }

  return { ok: true, threadId, path };
}

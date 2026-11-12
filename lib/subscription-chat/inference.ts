import "server-only";

import { z } from "zod";
import OpenAI from "openai";

import {
  RESOURCE,
  SubscriptionError,
  subscriptionResponseBody,
  type chatInputSchema,
} from "./policy";

const catalogSchema = z.object({
  models: z.array(
    z.object({
      slug: z.string(),
      display_name: z.string(),
      visibility: z.string(),
    })
  ),
});

export async function subscriptionModels(accessToken: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${RESOURCE}/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok)
    throw new SubscriptionError("ChatGPT models are unavailable. Reconnect or try again.", 502);
  return catalogSchema
    .parse(await response.json())
    .models.filter((model) => model.visibility === "list")
    .map(({ slug, display_name }) => ({ id: slug, name: display_name }));
}

export type SubscriptionEvent =
  | { type: "delta"; text: string }
  | { type: "completed"; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string };

export async function* subscriptionTurn(
  token: string,
  input: z.infer<typeof chatInputSchema>,
  signal: AbortSignal,
  fetcher?: typeof fetch
): AsyncGenerator<SubscriptionEvent> {
  // Explicit token + endpoint, no environment credentials and no automatic retries/fallbacks.
  const client = new OpenAI({
    apiKey: token,
    adminAPIKey: null,
    organization: null,
    project: null,
    baseURL: RESOURCE,
    maxRetries: 0,
    fetch: fetcher,
    logLevel: "off",
    fetchOptions: { redirect: "error" },
  });
  const stream = await client.responses.create(subscriptionResponseBody(input), { signal });
  let completed = false;
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") yield { type: "delta", text: event.delta };
    if (
      event.type === "response.failed" ||
      event.type === "error" ||
      event.type === "response.incomplete"
    ) {
      throw new SubscriptionError(
        "ChatGPT could not complete this turn. Check your plan limits or reconnect. No API fallback was used.",
        502
      );
    }
    if (event.type === "response.completed") {
      completed = true;
      yield {
        type: "completed",
        inputTokens: event.response.usage?.input_tokens ?? 0,
        outputTokens: event.response.usage?.output_tokens ?? 0,
      };
      break;
    }
  }
  if (!completed)
    throw new SubscriptionError(
      "The response ended before completion. Retry the turn; no API fallback was used.",
      502
    );
}

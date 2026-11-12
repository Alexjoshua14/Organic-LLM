import { z } from "zod";

export const RESOURCE = "https://api.openai.com/v1";
export const ISSUER = "https://auth.openai.com";
export const PLAN_SCOPE = "chatgpt.tokens.use.direct";
export const CALLBACK_PATH = "/api/subscription-chat/callback";
export const LAB_PATH = "/sandbox/subscription-chat";
export const LOGIN_COOKIE = "organic_subscription_login";
export const LOGIN_TTL_MS = 10 * 60_000;
export const TURN_TIMEOUT_MS = 120_000;

export class SubscriptionError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function subscriptionConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.ORGANIC_CHATGPT_ENABLED !== "true" || env.VERCEL || !env.ORGANIC_CHATGPT_OWNER_ID) {
    throw new SubscriptionError("Subscription chat is not enabled on this installation.", 404);
  }
  const origin = new URL(env.ORGANIC_CHATGPT_ORIGIN ?? "http://127.0.0.1:3000");
  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new SubscriptionError("Subscription chat requires an HTTP 127.0.0.1 origin.", 503);
  return { origin: origin.origin, ownerId: env.ORGANIC_CHATGPT_OWNER_ID };
}

export function authorizeSubscriptionRequest(
  request: Request,
  userId: string | null,
  env: NodeJS.ProcessEnv = process.env
) {
  const config = subscriptionConfig(env);
  if (!userId || userId !== config.ownerId) throw new SubscriptionError("Not authorized.", 403);
  const url = new URL(request.url);
  if (url.origin !== config.origin || request.headers.get("host") !== new URL(config.origin).host) {
    throw new SubscriptionError("Open this lab on its configured loopback address.", 403);
  }
  if (request.method !== "GET" && request.headers.get("origin") !== config.origin) {
    throw new SubscriptionError("Request origin did not match.", 403);
  }
  return config;
}

export const chatInputSchema = z
  .object({
    model: z.string().min(1).max(200),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(16_000),
          })
          .strict()
      )
      .min(1)
      .max(40),
  })
  .strict()
  .superRefine(({ messages }, ctx) => {
    if (
      messages.reduce((sum, message) => sum + message.content.length, 0) > 64_000 ||
      messages.some(
        (message, index) => message.role !== (index % 2 === 0 ? "user" : "assistant")
      ) ||
      messages.at(-1)?.role !== "user"
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Send alternating text turns ending with a user message, within 64,000 characters.",
      });
    }
  });
export type SubscriptionMessage = z.infer<typeof chatInputSchema>["messages"][number];

// An allowlist, not a filter over an ordinary API request: paid API settings never enter this path.
export function subscriptionResponseBody(input: z.infer<typeof chatInputSchema>) {
  return {
    model: input.model,
    store: false,
    stream: true as const,
    instructions:
      "You are Organic LLM, a thoughtful and precise conversational assistant. This text-only subscription lab has no tools or persistent memory. Do not claim to have used them.",
    input: input.messages,
  };
}

export function publicSubscriptionError(error: unknown) {
  return error instanceof SubscriptionError
    ? error.message
    : "The subscription request failed. Reconnect or try again. No API fallback was used.";
}

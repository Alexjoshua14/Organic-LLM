import { createLogger } from "../logger";
import { DEFAULT_CHAT_MODEL, ChatModel, ChatModelSchema } from "../schemas/chat";

const logger = createLogger("lib/llm/helpers");

/** ~5¢ at $25/M out — guardrail for routes that don't set their own limit */
export const GUARDRAIL_MAX_OUTPUT_TOKENS = 2_000;
/** ~5¢ at $5/M in — guardrail for input/context (use where provider supports it) */
export const GUARDRAIL_MAX_INPUT_TOKENS = 10_000;

/** Soft limit we tell the model (so it can wrap up); ~words is approximate. */
export const CHAT_RESPONSE_SOFT_MAX_TOKENS = 7_500;
/** Extra tokens after soft max so the model has room to finish its last thought. */
export const CHAT_RESPONSE_BUFFER_TOKENS = 300;

/** Actual API cap = soft + buffer (model is informed of soft limit in system prompt). */
export const CHAT_RESPONSE_MAX_OUTPUT_TOKENS =
  CHAT_RESPONSE_SOFT_MAX_TOKENS + CHAT_RESPONSE_BUFFER_TOKENS;

export function getChatResponseLengthInstruction(): string {
  const approxWords = Math.round(CHAT_RESPONSE_SOFT_MAX_TOKENS * 0.25); // ~4 tokens per word

  return `This response has a maximum length of approximately ${CHAT_RESPONSE_SOFT_MAX_TOKENS.toLocaleString()} tokens (roughly ${approxWords.toLocaleString()} words). Structure your answer to fit within this limit and end with a clear conclusion before you run out of space.`;
}

// Default model configuration
export const CHAT_MODEL = {
  name: DEFAULT_CHAT_MODEL,
  maxOutputTokens: CHAT_RESPONSE_MAX_OUTPUT_TOKENS,
};

/**
 * Gets a validated chat model, falling back to default if invalid
 * @param model - Optional model string to validate
 * @returns Validated chat model
 */
export function getChatModel(model?: ChatModel): ChatModel {
  if (!model) {
    logger.log("getChatModel", `No model provided, using default: ${DEFAULT_CHAT_MODEL.name}`);

    return DEFAULT_CHAT_MODEL;
  }

  const parseResult = ChatModelSchema.safeParse(model);

  if (!parseResult.success) {
    logger.error(
      "getChatModel",
      `Invalid model "${model}", falling back to default: ${DEFAULT_CHAT_MODEL.name}`
    );

    return DEFAULT_CHAT_MODEL;
  }

  logger.log("getChatModel", `Validated model: ${parseResult.data}`);

  return parseResult.data;
}
type MeasureResult<T> = { result: T; durationMs: number };

export async function measureAsync<T>(fn: () => Promise<T>): Promise<MeasureResult<T>> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;

  return { result, durationMs };
}

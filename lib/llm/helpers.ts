import { createLogger } from "../logger";
import {
  DEFAULT_CHAT_MODEL,
  ChatModel,
  ChatModelSchema,
} from "../schemas/chat";

const logger = createLogger("lib/llm/helpers");

// Default model configuration
export const CHAT_MODEL = {
  name: DEFAULT_CHAT_MODEL,
  maxOutputTokens: 3000,
};

/**
 * Gets a validated chat model, falling back to default if invalid
 * @param model - Optional model string to validate
 * @returns Validated chat model
 */
export function getChatModel(model?: ChatModel): ChatModel {
  if (!model) {
    logger.log(
      "getChatModel",
      `No model provided, using default: ${DEFAULT_CHAT_MODEL.name}`
    );
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

export async function measureAsync<T>(
  fn: () => Promise<T>
): Promise<MeasureResult<T>> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;

  return { result, durationMs };
}

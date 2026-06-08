import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/ollama/client");

export type OllamaConfig = {
  baseUrl: string;
  model: string;
};

export function getOllamaConfig(): OllamaConfig {
  const baseUrl = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";

  return { baseUrl, model };
}

export function getOllamaPlanModel(): string {
  return process.env.OLLAMA_PLAN_MODEL ?? getOllamaConfig().model;
}

type OllamaChatResponse = {
  message?: { content?: string };
};

/**
 * Single completion; `format: "json"` asks Ollama to return valid JSON in message.content.
 */
export async function ollamaChatJson(params: {
  system: string;
  user: string;
  model?: string;
}): Promise<string> {
  const { baseUrl, model: defaultModel } = getOllamaConfig();
  const model = params.model ?? defaultModel;
  const url = `${baseUrl}/api/chat`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");

    logger.error("ollamaChatJson", `${res.status} ${errText.slice(0, 500)}`);
    throw new Error(`Ollama request failed: ${res.status}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  const content = data.message?.content?.trim() ?? "";

  if (!content) {
    throw new Error("Ollama returned empty content");
  }

  return content;
}

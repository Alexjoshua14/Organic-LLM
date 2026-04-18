import type { UIMessage } from "ai";
import type { Thread } from "@/lib/schemas/chat";

import { unstable_cache } from "next/cache";

import {
  getCachedTabTitlePrimary,
  isTabTitleRedisConfigured,
  setCachedTabTitlePrimary,
  TAB_TITLE_CACHE_TTL_SEC,
  tabTitleCacheDigest,
} from "./tab-title-cache";
import { primarySegment } from "./tab-title";

import { generateBrowserTabTitlePrimary } from "@/lib/llm/browser-tab-title";
import { isUntitledStrataTitle, type StrataPageWithSections } from "@/lib/schemas/strata";

async function invokeTabTitleLlm(options: {
  cacheKey: string;
  sourceHint: string;
  fallback: string;
  contextId: string;
}): Promise<string | null> {
  const payload = {
    sourceHint: options.sourceHint,
    fallback: options.fallback,
    contextId: options.contextId,
  };

  if (isTabTitleRedisConfigured()) {
    return generateBrowserTabTitlePrimary(payload);
  }

  const runner = unstable_cache(
    async () => generateBrowserTabTitlePrimary(payload),
    ["browser-tab-llm", options.cacheKey],
    { revalidate: TAB_TITLE_CACHE_TTL_SEC }
  );

  return runner();
}

function uiMessagePlainText(message: UIMessage): string {
  const parts = message.parts ?? [];
  const fromParts = parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p)
    .map((p) => p.text)
    .join("");

  if (fromParts.trim()) {
    return fromParts.trim();
  }
  const c = (message as { content?: unknown }).content;

  return typeof c === "string" ? c.trim() : "";
}

function buildChatSourceHint(thread: Thread, messages: UIMessage[]): string {
  const lines: string[] = [];
  const title = thread.title?.trim();

  if (title) {
    lines.push(`Thread title: ${title}`);
  }
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map(uiMessagePlainText)
    .filter(Boolean)
    .slice(0, 3);

  for (const t of userTexts) {
    lines.push(`User: ${t}`);
  }

  return lines.join("\n").slice(0, 2_000);
}

export type ChatTabExperience = "chat" | "arcadia" | "spark" | "morphChat";

export async function resolveChatBrowserTabTitlePrimary(options: {
  experience: ChatTabExperience;
  thread: Thread;
  messages: UIMessage[];
}): Promise<string> {
  const fallbacks: Record<ChatTabExperience, string> = {
    chat: "Chat",
    arcadia: "Arcadia",
    spark: "Spark",
    morphChat: "Morph chat",
  };
  const fallback = fallbacks[options.experience];

  const revision = options.thread.updated_at ?? options.thread.id;

  const cacheKey = tabTitleCacheDigest([
    "chat-tab",
    options.experience,
    options.thread.id,
    revision,
    options.thread.title ?? "",
  ]);

  const cached = await getCachedTabTitlePrimary(cacheKey);

  if (cached) {
    return primarySegment(cached, fallback);
  }

  const hint = buildChatSourceHint(options.thread, options.messages);

  if (!hint.trim()) {
    return primarySegment(options.thread.title, fallback);
  }

  const llm = await invokeTabTitleLlm({
    cacheKey,
    sourceHint: hint,
    fallback,
    contextId: `${options.experience}:${options.thread.id}`,
  });

  const chosen = llm ?? primarySegment(options.thread.title, fallback);
  const normalized = primarySegment(chosen, fallback);

  if (llm) {
    await setCachedTabTitlePrimary(cacheKey, normalized);
  }

  return normalized;
}

function buildStrataSourceHint(data: StrataPageWithSections): string {
  const title = data.page.title?.trim() ?? "";
  const refined = data.sections.refined_text?.content?.trim() ?? "";
  const raw = data.sections.raw_text?.content?.trim() ?? "";
  const parts = [`Page title: ${title || "(untitled)"}`];

  if (refined) {
    parts.push(`Refined:\n${refined.slice(0, 900)}`);
  } else if (raw) {
    parts.push(`Raw:\n${raw.slice(0, 900)}`);
  }

  return parts.join("\n\n").slice(0, 2_000);
}

export async function resolveStrataBrowserTabTitlePrimary(
  data: StrataPageWithSections
): Promise<string> {
  const fallback = "Strata";
  const title = data.page.title?.trim();
  const hasNamedTitle = Boolean(title && !isUntitledStrataTitle(title));
  const hasBody = Boolean(
    data.sections.refined_text?.content?.trim() || data.sections.raw_text?.content?.trim()
  );

  if (!hasNamedTitle && !hasBody) {
    return primarySegment(null, fallback);
  }

  if (hasNamedTitle && title && title.length <= 44 && !hasBody) {
    return primarySegment(title, fallback);
  }

  const revision = `${data.page.updated_at}:${title ?? ""}`;
  const cacheKey = tabTitleCacheDigest(["strata-tab", data.page.id, revision]);

  const cached = await getCachedTabTitlePrimary(cacheKey);

  if (cached) {
    return primarySegment(cached, fallback);
  }

  const hint = buildStrataSourceHint(data);

  if (!hint.trim()) {
    return primarySegment(hasNamedTitle ? title : null, fallback);
  }

  const llm = await invokeTabTitleLlm({
    cacheKey,
    sourceHint: hint,
    fallback,
    contextId: `strata:${data.page.id}`,
  });

  const chosen = llm ?? primarySegment(hasNamedTitle ? title : null, fallback);
  const normalized = primarySegment(chosen, fallback);

  if (llm) {
    await setCachedTabTitlePrimary(cacheKey, normalized);
  }

  return normalized;
}

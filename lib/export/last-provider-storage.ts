import { OPEN_IN_CHAT_PROVIDERS, type OpenInChatProvider } from "@/lib/export/prompts";

export function exportLastProviderStorageKey(presetId: string): string {
  return `organic-llm:export:lastProvider:${presetId}`;
}

function isOpenInProvider(value: string): value is OpenInChatProvider {
  return (OPEN_IN_CHAT_PROVIDERS as readonly string[]).includes(value);
}

export function readLastOpenInProvider(
  presetId: string,
  storage?: Storage | null
): OpenInChatProvider | null {
  if (typeof window === "undefined" && storage === undefined) return null;
  const s = storage ?? (typeof window !== "undefined" ? window.localStorage : null);

  if (!s) return null;
  const raw = s.getItem(exportLastProviderStorageKey(presetId));

  if (!raw || !isOpenInProvider(raw)) return null;

  return raw;
}

export function writeLastOpenInProvider(
  presetId: string,
  provider: OpenInChatProvider,
  storage?: Storage | null
): void {
  if (typeof window === "undefined" && storage === undefined) return;
  const s = storage ?? (typeof window !== "undefined" ? window.localStorage : null);

  if (!s) return;
  s.setItem(exportLastProviderStorageKey(presetId), provider);
}

export function sortOpenInProvidersByLastUsed<T extends OpenInChatProvider>(
  presetId: string,
  providers: readonly T[],
  storage?: Storage | null
): T[] {
  const last = readLastOpenInProvider(presetId, storage);

  if (!last || !providers.includes(last as T)) {
    return [...providers];
  }
  const rest = providers.filter((p) => p !== last);

  return [last as T, ...rest];
}

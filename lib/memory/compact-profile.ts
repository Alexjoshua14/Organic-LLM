import type { MemoryItemType } from "@/lib/schemas/memory";
import type { ProfileSection, ProfileTree } from "@/lib/schemas/profileTree";

import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import { formatMemoriesForPrompt } from "@/lib/memory/memory-relevance";

export type CompactProfileOptions = {
  maxSections: number;
  rich: boolean;
  tokenCap: number;
};

function clip(text: string, maxChars: number): string {
  const t = text.trim();

  if (t.length <= maxChars) return t;

  return `${t.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function formatSection(section: ProfileSection, rich: boolean): string {
  const bodyMax = rich ? 400 : 200;
  const itemCap = rich ? 6 : 2;
  const lines: string[] = [`## ${section.title}`];

  if (section.body?.trim()) {
    lines.push(clip(section.body, bodyMax));
  }

  const items = (section.items ?? []).slice(0, itemCap);

  for (const item of items) {
    if (item.trim()) lines.push(`- ${item.trim()}`);
  }

  return lines.join("\n");
}

function trimToTokenCap(text: string, tokenCap: number): string {
  if (tokenCap <= 0) return "";
  if (!text.trim()) return "";
  if (estimateTokenCountSync(text) <= tokenCap) return text;

  const units = text.split(/\s+/);
  let lo = 1;
  let hi = units.length;
  let best = clip(text, 80);

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = `${units.slice(0, mid).join(" ")}…`;

    if (estimateTokenCountSync(candidate) <= tokenCap) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

/**
 * Compact Settings profile tree into a standing portrait for the Arcadia system prompt.
 * Empty / missing trees return "".
 */
export function compactProfileTree(
  tree: ProfileTree | null | undefined,
  options: CompactProfileOptions
): string {
  if (!tree || options.tokenCap <= 0 || options.maxSections <= 0) return "";

  const lines: string[] = [];

  if (tree.headline.trim()) lines.push(tree.headline.trim());
  if (tree.roles?.length) lines.push(`Roles: ${tree.roles.join(", ")}`);
  if (tree.signature?.trim()) lines.push(tree.signature.trim());

  const sections = tree.sections.slice(0, options.maxSections);

  for (const section of sections) {
    const block = formatSection(section, options.rich);

    if (block.trim()) lines.push(block);
  }

  return trimToTokenCap(lines.join("\n\n"), options.tokenCap);
}

export type TrimMemoryPackParams = {
  portraitText: string;
  memories: MemoryItemType[];
  tokenCap: number;
};

export type TrimMemoryPackResult = {
  portraitText: string;
  memories: MemoryItemType[];
  memoriesText: string;
};

/**
 * Keep portrait first, then drop lowest-priority (trailing) memory bullets until
 * portrait + bullets fit {@link TrimMemoryPackParams.tokenCap}. Inventory is counted
 * separately by the caller if needed.
 */
export function trimMemoryPackToTokenCap(params: TrimMemoryPackParams): TrimMemoryPackResult {
  const { tokenCap } = params;
  let portraitText = params.portraitText.trim();
  let memories = [...params.memories];

  if (tokenCap <= 0) {
    return { portraitText: "", memories: [], memoriesText: "" };
  }

  const packTokens = () => {
    const memoriesText = formatMemoriesForPrompt(memories);
    const joined = [portraitText, memoriesText].filter(Boolean).join("\n\n");

    return { memoriesText, tokens: estimateTokenCountSync(joined) };
  };

  let { memoriesText, tokens } = packTokens();

  while (memories.length > 0 && tokens > tokenCap) {
    memories = memories.slice(0, -1);
    ({ memoriesText, tokens } = packTokens());
  }

  if (tokens > tokenCap && portraitText) {
    const memoriesBudget = estimateTokenCountSync(memoriesText);
    const portraitCap = Math.max(0, tokenCap - memoriesBudget);

    portraitText = trimToTokenCap(portraitText, portraitCap);
    ({ memoriesText, tokens } = packTokens());
  }

  if (tokens > tokenCap) {
    portraitText = "";
    memories = [];
    memoriesText = "";
  }

  return { portraitText, memories, memoriesText };
}

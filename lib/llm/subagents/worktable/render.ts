import type {
  ContextBundle,
  ResolvedWorktableItem,
  Worktable,
  WorktableItem,
  BundleSelection,
} from "@/lib/llm/subagents/worktable/types";

import { randomUUID } from "crypto";
import { resolveSubagentIdentity } from "@/lib/arcadia/multitask/subagent-identity";
import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import {
  contextItemPreview,
  frameContextData,
  selectContextExcerpt,
  type ContextItemSnapshot,
  type ContextItemManifest,
} from "@/lib/llm/subagents/threads/context-items";
import { WORKTABLE_LIMITS } from "./types";
import { findBundle } from "./operations";

/** Latest reply in a subagent's thread, for `live_subagent_output` items. */
export type ResolveLiveOutput = (
  agentId: string
) => Promise<{ text: string; messageId: string } | null>;

function agentLabel(agentId: string | null): string {
  if (!agentId) return "Subagent";
  const identity = resolveSubagentIdentity(agentId);

  return `${identity.name} (${identity.role})`;
}

function itemHeading(item: ResolvedWorktableItem): string {
  const base =
    item.kind === "note"
      ? "Note"
      : item.kind === "memory"
        ? "Memory"
        : item.kind === "user_message"
          ? "The user's words"
          : item.kind === "live_subagent_output"
            ? `${agentLabel(item.agentId)} — latest output`
            : `${agentLabel(item.agentId)} — output`;

  return item.label ? `${base} · ${item.label}` : base;
}

/** Select without editing the saved bundle; explicit empty items sends instructions only. */
export function selectDispatchBundles(
  table: Worktable,
  selections: ReadonlyArray<BundleSelection>
) {
  const bundles: ContextBundle[] = [];
  let omittedItems = 0;
  for (const selection of selections) {
    const ref = typeof selection === "string" ? selection : selection.bundle;
    const bundle = findBundle(table, ref);
    if (!bundle) throw new Error(`No bundle "${ref}" on the worktable.`);
    if (bundles.some((candidate) => candidate.id === bundle.id))
      throw new Error(`Select bundle "${bundle.name}" once, combining its requested items.`);
    const chosen = typeof selection === "string" ? undefined : selection.items;
    const ids = chosen?.map((item) => item.itemId);
    if (ids && new Set(ids).size !== ids.length) throw new Error("Select each bundle item once.");
    for (const id of ids ?? [])
      if (!bundle.items.some((item) => item.id === id))
        throw new Error(`No item ${id} in "${bundle.name}".`);
    const items = bundle.items
      .filter((item) => !ids || ids.includes(item.id))
      .map((item) => {
        const range = chosen?.find((selected) => selected.itemId === item.id);
        if (!range || (range.offset === undefined && range.limit === undefined)) return item;
        if (item.kind === "live_subagent_output") {
          const remaining =
            item.sourceLimit === undefined ? undefined : item.sourceLimit - (range.offset ?? 0);
          if (remaining !== undefined && remaining <= 0)
            throw new Error("The selected live excerpt is outside its saved range.");
          return {
            ...item,
            sourceOffset: (item.sourceOffset ?? 0) + (range.offset ?? 0),
            sourceLimit:
              remaining === undefined ? range.limit : Math.min(remaining, range.limit ?? remaining),
          };
        }
        const excerpt = selectContextExcerpt(item.text, range);
        return {
          ...item,
          ...excerpt,
          sourceOffset: (item.sourceOffset ?? 0) + excerpt.sourceOffset,
        };
      });
    omittedItems += bundle.items.length - items.length;
    bundles.push({
      ...bundle,
      items,
      instructions:
        typeof selection !== "string" && selection.includeInstructions === false
          ? null
          : bundle.instructions,
    });
  }
  return { bundles, omittedItems };
}

/**
 * Context block appended under a dispatch brief. Live items resolve now, so what the subagent's
 * thread records is exactly what it was sent.
 */
export async function renderDispatchContext(args: {
  bundles: ReadonlyArray<ContextBundle>;
  items: ReadonlyArray<ResolvedWorktableItem>;
  resolveLive: ResolveLiveOutput;
}): Promise<{ context: string; items: ContextItemSnapshot[]; manifest: ContextItemManifest[] }> {
  const sections: string[] = [];
  const snapshots: ContextItemSnapshot[] = [];
  const manifest: ContextItemManifest[] = [];
  const seen = new Map<string, string>();
  const liveOutputs = new Map<string, ReturnType<ResolveLiveOutput>>();
  let sourceChars = 0;
  const renderItem = async (
    item: ResolvedWorktableItem,
    bundleId?: string,
    bundleItemId?: string
  ) => {
    if (item.text.length === 5_997 && item.text.endsWith("\n…(truncated)"))
      throw new Error(
        "This saved item was truncated by an older version. Replace it from its original source before dispatch."
      );
    let resolved = item;
    if (item.kind === "live_subagent_output") {
      const agent = item.agentId;
      if (agent && !liveOutputs.has(agent)) liveOutputs.set(agent, args.resolveLive(agent));
      const live = agent ? await liveOutputs.get(agent) : null;
      resolved = {
        ...item,
        ...selectContextExcerpt(live?.text ?? "(No output yet.)", {
          offset: item.sourceOffset,
          limit: item.sourceLimit,
        }),
        sourceMessageId: live?.messageId ?? null,
      };
    }
    sourceChars += resolved.text.length;
    if (
      resolved.text.length > WORKTABLE_LIMITS.sourceChars ||
      sourceChars > WORKTABLE_LIMITS.dispatchSourceChars
    )
      throw new Error(
        `Selected originals exceed storage limits (${WORKTABLE_LIMITS.sourceChars} per item, ${WORKTABLE_LIMITS.dispatchSourceChars} per dispatch). Select smaller excerpts.`
      );
    const snapshot: ContextItemSnapshot = {
      itemId: randomUUID(),
      kind: resolved.kind,
      label: resolved.label,
      text: resolved.text,
      agentId: resolved.agentId,
      sourceMessageId: resolved.sourceMessageId,
      sourceOffset: resolved.sourceOffset,
      bundleId,
      bundleItemId,
    };
    snapshots.push(snapshot);
    const preview = contextItemPreview(snapshot);
    const key = JSON.stringify([
      snapshot.kind,
      snapshot.text,
      snapshot.sourceMessageId,
      snapshot.agentId,
    ]);
    const duplicateOf = seen.get(key);
    if (duplicateOf) {
      manifest.push({
        ...preview.manifest,
        deliveredChars: 0,
        truncated: false,
        estimatedTokens: 0,
        duplicateOf,
      });
      return "";
    }
    seen.set(key, snapshot.itemId);
    const rendered = `[${itemHeading(item)}]\n${frameContextData({ itemId: snapshot.itemId, content: preview.content })}`;
    manifest.push({ ...preview.manifest, estimatedTokens: estimateTokenCountSync(rendered) });
    return rendered;
  };

  for (const bundle of args.bundles) {
    const parts = [`### Context: ${bundle.name}`];

    if (bundle.instructions) parts.push(`Standing instructions:\n${bundle.instructions}`);
    for (const item of bundle.items) parts.push(await renderItem(item, bundle.id, item.id));
    sections.push(parts.filter(Boolean).join("\n\n"));
  }

  if (args.items.length > 0) {
    const parts = ["### Context"];

    for (const item of args.items) parts.push(await renderItem(item));
    sections.push(parts.filter(Boolean).join("\n\n"));
  }

  return { context: sections.join("\n\n"), items: snapshots, manifest };
}

function describeItem(item: WorktableItem) {
  return {
    id: item.id,
    kind: item.kind,
    heading: itemHeading(item),
    ...(item.agentId ? { agentId: item.agentId } : {}),
    ...(item.sourceMessageId ? { sourceMessageId: item.sourceMessageId } : {}),
    text:
      item.kind === "live_subagent_output"
        ? "(resolved when sent)"
        : item.text.slice(0, WORKTABLE_LIMITS.itemChars),
    originalChars: item.text.length,
    truncated: item.text.length > WORKTABLE_LIMITS.itemChars,
  };
}

/** Full bundle for the `worktable` tool's view and edit results. */
export function describeBundle(bundle: ContextBundle) {
  return {
    id: bundle.id,
    name: bundle.name,
    purpose: bundle.purpose,
    instructions: bundle.instructions,
    sendCount: bundle.sendCount,
    lastSentAt: bundle.lastSentAt,
    items: bundle.items.map(describeItem),
  };
}

/** One line per bundle — the listing and the per-turn prompt fragment. */
export function summarizeBundle(bundle: ContextBundle): string {
  const sent = bundle.sendCount > 0 ? `, sent ${bundle.sendCount}×` : "";
  const purpose = bundle.purpose ? ` — ${bundle.purpose}` : "";

  return `- ${bundle.name} (id=${bundle.id}, ${bundle.items.length} items${sent})${purpose}`;
}

/** Per-turn system fragment: what is already on the worktable. */
export function formatWorktableFragment(worktable: Worktable | null): string {
  if (!worktable) {
    return [
      "[Worktable]",
      "Worktable storage is unavailable this turn. Attach context inline with dispatch_subagent items.",
    ].join("\n");
  }
  if (worktable.bundles.length === 0) {
    return ["[Worktable]", "No saved bundles yet."].join("\n");
  }

  return ["[Worktable]", "Saved context bundles:", ...worktable.bundles.map(summarizeBundle)].join(
    "\n"
  );
}

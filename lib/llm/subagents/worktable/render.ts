import type {
  ContextBundle,
  ResolvedWorktableItem,
  Worktable,
  WorktableItem,
} from "@/lib/llm/subagents/worktable/types";

import { resolveSubagentIdentity } from "@/lib/arcadia/multitask/subagent-identity";

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

async function renderItem(
  item: ResolvedWorktableItem,
  resolveLive: ResolveLiveOutput
): Promise<string> {
  let text = item.text;

  if (item.kind === "live_subagent_output") {
    const live = item.agentId ? await resolveLive(item.agentId) : null;

    text = live?.text ?? "(No output yet.)";
  }

  return `[${itemHeading(item)}]\n${text.trim()}`;
}

/**
 * Context block appended under a dispatch brief. Live items resolve now, so what the subagent's
 * thread records is exactly what it was sent.
 */
export async function renderDispatchContext(args: {
  bundles: ReadonlyArray<ContextBundle>;
  items: ReadonlyArray<ResolvedWorktableItem>;
  resolveLive: ResolveLiveOutput;
}): Promise<string> {
  const sections: string[] = [];

  for (const bundle of args.bundles) {
    const parts = [`### Context: ${bundle.name}`];

    if (bundle.instructions) parts.push(`Standing instructions:\n${bundle.instructions}`);
    for (const item of bundle.items) parts.push(await renderItem(item, args.resolveLive));
    sections.push(parts.join("\n\n"));
  }

  if (args.items.length > 0) {
    const parts = ["### Context"];

    for (const item of args.items) parts.push(await renderItem(item, args.resolveLive));
    sections.push(parts.join("\n\n"));
  }

  return sections.join("\n\n");
}

function describeItem(item: WorktableItem) {
  return {
    id: item.id,
    kind: item.kind,
    heading: itemHeading(item),
    ...(item.agentId ? { agentId: item.agentId } : {}),
    ...(item.sourceMessageId ? { sourceMessageId: item.sourceMessageId } : {}),
    text: item.kind === "live_subagent_output" ? "(resolved when sent)" : item.text,
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

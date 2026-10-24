type LineChange = {
  kind: "added" | "removed" | "changed";
  before?: string;
  after?: string;
};

function normalizeLines(input: string): string[] {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
}

export function computeRawTextLineChanges(previousRaw: string, currentRaw: string): LineChange[] {
  const before = normalizeLines(previousRaw);
  const after = normalizeLines(currentRaw);
  const max = Math.max(before.length, after.length);
  const changes: LineChange[] = [];

  for (let i = 0; i < max; i++) {
    const b = before[i];
    const a = after[i];

    if (b === a) continue;
    if (b === undefined && a !== undefined) {
      changes.push({ kind: "added", after: a });
      continue;
    }
    if (a === undefined && b !== undefined) {
      changes.push({ kind: "removed", before: b });
      continue;
    }
    changes.push({ kind: "changed", before: b ?? "", after: a ?? "" });
  }

  return changes;
}

export function buildRawDiffSummary(previousRaw: string, currentRaw: string): string {
  if (previousRaw === currentRaw) {
    return "No raw-text differences detected.";
  }

  const changes = computeRawTextLineChanges(previousRaw, currentRaw);
  const added = changes.filter((c) => c.kind === "added").length;
  const removed = changes.filter((c) => c.kind === "removed").length;
  const changed = changes.filter((c) => c.kind === "changed").length;

  const notable = changes
    .slice(0, 6)
    .map((entry) => {
      if (entry.kind === "added") return `+ ${entry.after ?? ""}`.slice(0, 160);
      if (entry.kind === "removed") return `- ${entry.before ?? ""}`.slice(0, 160);

      return `~ ${entry.before ?? ""} => ${entry.after ?? ""}`.slice(0, 160);
    })
    .join("\n");

  return [
    `Line-level diff summary:`,
    `- Changed lines: ${changed}`,
    `- Added lines: ${added}`,
    `- Removed lines: ${removed}`,
    notable.length > 0 ? `Notable deltas:\n${notable}` : "Notable deltas: (none)",
  ].join("\n");
}

export function buildRawDiffPromptBlock(args: {
  previousRawText: string | null;
  currentRawText: string;
}): { diffSummary: string; block: string } {
  const prev = args.previousRawText ?? "";
  const diffSummary = buildRawDiffSummary(prev, args.currentRawText);
  const block = [
    "Raw input delta context:",
    `Previous generation raw text:\n${prev || "(none)"}`,
    `Current raw text:\n${args.currentRawText}`,
    `Diff summary:\n${diffSummary}`,
  ].join("\n\n");

  return { diffSummary, block };
}

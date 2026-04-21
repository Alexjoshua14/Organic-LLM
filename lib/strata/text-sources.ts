import {
  STRATA_TEXT_SOURCES_MAX,
  StrataSourceComposerSettings,
  StrataSourceComposerSettingsSchema,
  StrataTextSourceNode,
  StrataTextSourceNodeSchema,
} from "@/lib/schemas/strata";

export function parseTextSourcesFromContentJson(
  contentJson: Record<string, unknown> | null | undefined
): StrataTextSourceNode[] {
  const raw = contentJson?.textSources;
  if (!Array.isArray(raw)) return [];
  const out: StrataTextSourceNode[] = [];
  for (const item of raw) {
    const parsed = StrataTextSourceNodeSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out.slice(0, STRATA_TEXT_SOURCES_MAX);
}

export function parseSourceComposerSettings(
  contentJson: Record<string, unknown> | null | undefined
): StrataSourceComposerSettings | null {
  const raw = contentJson?.sourceComposerSettings;
  const parsed = StrataSourceComposerSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Deterministic corpus for `raw_text.content` so generation and Strata chat grounding stay stable.
 */
export function buildCorpusFromTextSources(nodes: StrataTextSourceNode[]): string {
  const limited = nodes.slice(0, STRATA_TEXT_SOURCES_MAX);
  return limited
    .map((n, i) => {
      const header = `--- Source ${i + 1}: ${n.title} [${n.kind}] ---\n`;
      const body = n.body.trimEnd();
      return header + body + "\n";
    })
    .join("\n");
}

export function setTextSourcesInContentJson(
  existing: Record<string, unknown> | null | undefined,
  textSources: StrataTextSourceNode[],
  settingsPatch?: Partial<StrataSourceComposerSettings> | null
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(existing ?? {}) };
  base.textSources = textSources.slice(0, STRATA_TEXT_SOURCES_MAX);
  if (settingsPatch && Object.keys(settingsPatch).length > 0) {
    const prev = parseSourceComposerSettings(existing) ?? {};
    base.sourceComposerSettings = { ...prev, ...settingsPatch };
  }
  return base;
}

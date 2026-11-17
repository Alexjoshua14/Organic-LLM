export type AudioSnippetMetaItem = {
  key: string;
  label: string;
  /** Duration uses tabular numerals; other labels stay proportional. */
  tabularNums?: boolean;
};

type BuildAudioSnippetMetaItemsInput = {
  duration?: string | null;
  tone?: string | null;
  costLabel: string;
};

/**
 * Ordered meta chips for the audio snippet row. Optional duration/tone are
 * omitted when absent so separators only appear between real neighbours.
 */
export function buildAudioSnippetMetaItems({
  duration,
  tone,
  costLabel,
}: BuildAudioSnippetMetaItemsInput): AudioSnippetMetaItem[] {
  const items: AudioSnippetMetaItem[] = [];
  const trimmedDuration = duration?.trim();
  const trimmedTone = tone?.trim();

  if (trimmedDuration) {
    items.push({ key: "duration", label: trimmedDuration, tabularNums: true });
  }
  if (trimmedTone) {
    items.push({ key: "tone", label: trimmedTone });
  }
  items.push({ key: "cost", label: `Est. cost ${costLabel}` });

  return items;
}

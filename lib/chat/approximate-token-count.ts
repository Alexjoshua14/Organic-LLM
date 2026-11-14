/** About four characters a token: the estimate when the tokenizer isn't loaded or can't encode. */
export function approximateTokenCount(text: string): number {
  const trimmed = text.trim();

  return trimmed ? Math.max(1, Math.ceil(trimmed.length / 4)) : 0;
}

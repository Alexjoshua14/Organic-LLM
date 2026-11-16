/**
 * Appends the current date as the last section of a system prompt.
 *
 * The system prompt sits before the conversation in the provider's cache prefix, so any change
 * here re-bills the whole history at the uncached rate. Stamping to the hour (not the
 * millisecond) keeps consecutive turns byte-identical and cacheable; it costs one cache break an
 * hour. Call this once, on the final string passed to `streamText`.
 */
export function appendCurrentDate(systemPrompt: string, now: Date = new Date()): string {
  const hour = `${now.toISOString().slice(0, 13)}:00Z`;

  return `${systemPrompt}\n\nAdditional Info:\nThe current date and hour (UTC) is ${hour}`;
}

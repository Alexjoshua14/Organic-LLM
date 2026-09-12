/**
 * Appends the current date as the last section of a system prompt.
 *
 * The timestamp changes on every request. Keeping it last means it never invalidates the
 * prompt-cache prefix formed by the sections before it. Call this once, on the final string
 * passed to `streamText`.
 */
export function appendCurrentDate(systemPrompt: string, now: Date = new Date()): string {
  return `${systemPrompt}\n\nAdditional Info:\nThe current date is ${now.toISOString()}`;
}

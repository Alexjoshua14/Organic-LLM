export type SlashCommand = { name: string; argument: string };

const SLASH_COMMAND = /^\/([a-z][\w-]*)(?:\s+([\s\S]*))?$/i;

/** `/btw what does X mean?` → `{ name: "btw", argument: "what does X mean?" }`. */
export function parseSlashCommand(text: string): SlashCommand | null {
  const match = SLASH_COMMAND.exec(text.trim());

  if (!match) return null;

  return { name: match[1]!.toLowerCase(), argument: (match[2] ?? "").trim() };
}

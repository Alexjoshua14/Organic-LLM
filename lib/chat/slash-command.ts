export type SlashCommand = { name: string; argument: string };

/**
 * How the composer's slash menu shows each command a chat surface can run. A command appears
 * only where the surface handles it (CoreInput's `slashCommands`).
 */
export const SLASH_COMMAND_DETAILS: Record<string, { label: string; hint: string }> = {
  btw: { label: "By the way", hint: "Ask aside, without adding to the thread" },
};

const SLASH_COMMAND = /^\/([a-z][\w-]*)(?:\s+([\s\S]*))?$/i;

/** `/btw what does X mean?` → `{ name: "btw", argument: "what does X mean?" }`. */
export function parseSlashCommand(text: string): SlashCommand | null {
  const match = SLASH_COMMAND.exec(text.trim());

  if (!match) return null;

  return { name: match[1]!.toLowerCase(), argument: (match[2] ?? "").trim() };
}

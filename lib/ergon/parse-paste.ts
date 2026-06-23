const CHECKBOX_LINE = /^[-*+]\s*\[[ xX]\]\s*(.+)$/;
const BULLET_LINE = /^[-*+]\s+(.+)$/;
const NUMBERED_LINE = /^\d+[.)]\s+(.+)$/;

/** Strip wrapping quotes some apps add when copying list blocks. */
function normalizePasteText(text: string): string {
  return text.replace(/^["']|["']$/g, "").trim();
}

/**
 * Parse pasted plain text or markdown checklists into task titles.
 * Supports `- [ ] item`, bullets, numbered lines, and plain multi-line text.
 */
export function parsePastedTaskTitles(text: string, minLength = 2): string[] {
  const normalized = normalizePasteText(text);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim());

  const titles: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    const checkbox = line.match(CHECKBOX_LINE);

    if (checkbox) {
      titles.push(checkbox[1].trim());
      continue;
    }

    const bullet = line.match(BULLET_LINE);

    if (bullet) {
      titles.push(bullet[1].trim());
      continue;
    }

    const numbered = line.match(NUMBERED_LINE);

    if (numbered) {
      titles.push(numbered[1].trim());
      continue;
    }

    titles.push(line);
  }

  return titles.filter((title) => title.length >= minLength);
}

export function isMultiLinePaste(text: string): boolean {
  return normalizePasteText(text).includes("\n");
}

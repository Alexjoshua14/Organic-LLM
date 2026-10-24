"use client";

function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const ok = document.execCommand("copy");

  document.body.removeChild(textarea);

  return ok;
}

/**
 * Copies text to clipboard with a robust fallback path.
 * Returns true when copy succeeds, false otherwise.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  const hasClipboard = typeof navigator !== "undefined" && navigator.clipboard?.writeText;

  try {
    if (hasClipboard) {
      await navigator.clipboard.writeText(text);

      return true;
    }

    return copyViaExecCommand(text);
  } catch {
    try {
      return copyViaExecCommand(text);
    } catch {
      return false;
    }
  }
}

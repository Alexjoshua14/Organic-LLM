/**
 * True when a keyboard shortcut should not steal focus from user text entry.
 */
export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (target == null || typeof (target as Node).nodeType !== "number") return false;

  const el = target as HTMLElement;

  if (el.isContentEditable) return true;

  const tag = el.tagName?.toLowerCase();

  if (tag === "input") {
    const type = (el as HTMLInputElement).type?.toLowerCase();

    if (type === "button" || type === "checkbox" || type === "radio" || type === "submit") {
      return false;
    }

    return !(el as HTMLInputElement).readOnly;
  }

  if (tag === "textarea") {
    return !(el as HTMLTextAreaElement).readOnly;
  }

  if (tag === "select") {
    return !(el as HTMLSelectElement).disabled;
  }

  return Boolean(el.closest("[contenteditable='true']"));
}

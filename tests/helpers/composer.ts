import { fireEvent } from "@testing-library/react";

/**
 * Sets CoreInput's draft as a user typing would leave it. The visible composer is a rich-text
 * editor; its hidden `message` textarea carries the Markdown draft (the form field and the
 * ref CoreInput uses), so changing it updates the draft and the editor together.
 */
export function composerField(root: ParentNode) {
  const field = root.querySelector<HTMLTextAreaElement>('textarea[name="message"]');

  if (!field) throw new Error("CoreInput's message field was not found");

  return field;
}

export function setComposerText(root: ParentNode, value: string) {
  fireEvent.change(composerField(root), { target: { value } });
}

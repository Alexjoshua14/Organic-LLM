import type { Editor } from "@tiptap/core";

import { TextSelection } from "@tiptap/pm/state";

export const EDITOR_FIXTURES = {
  empty: "",
  short: "Help me think this through.",
  markdown:
    "Compare **two approaches** to `useChat`.\n\n- Keep the draft stable\n- Preserve selection on mobile\n\n```ts\nconst draft = 'A thought in progress';\n```\n\n> What would make this simpler?",
  long: Array.from(
    { length: 24 },
    (_, index) =>
      `Paragraph ${index + 1}: A longer thought with **emphasis**, an inline \`value\`, and enough text to exercise wrapping, scrolling, selection, and editing on a phone.`
  ).join("\n\n"),
} as const;

export const EDITOR_COMMANDS = [
  { id: "code", label: "Code block", hint: "Write a snippet" },
  { id: "list", label: "Bullet list", hint: "Break a thought into parts" },
  { id: "quote", label: "Quote", hint: "Bring in a passage" },
  { id: "heading", label: "Heading", hint: "Give a thought a title" },
] as const;

export type EditorCommand = (typeof EDITOR_COMMANDS)[number];
/** `split`: the line follows a Shift+Enter break, so `from` includes it and running splits the block. */
export type SlashMatch = { from: number; to: number; query: string; split?: boolean };

/**
 * The text typed on the cursor's current line. Shift+Enter inserts a hard break inside a
 * paragraph, so a line can start mid-paragraph; `from` then covers the break itself.
 */
function currentLine(editor: Editor) {
  const { $from } = editor.state.selection;
  let lineOffset = 0;
  let breakOffset = -1;

  $from.parent.forEach((child, offset) => {
    if (child.type.name === "hardBreak" && offset + child.nodeSize <= $from.parentOffset) {
      lineOffset = offset + child.nodeSize;
      breakOffset = offset;
    }
  });

  return {
    text: $from.parent.textBetween(lineOffset, $from.parentOffset, "\n", "\ufffc"),
    from: $from.start() + (breakOffset >= 0 ? breakOffset : 0),
    split: breakOffset >= 0,
  };
}

/** Only a leading slash in an ordinary paragraph is a command, never code or a URL. */
export function findEditorSlash(editor: Editor): SlashMatch | null {
  const { selection } = editor.state;
  const { $from, empty } = selection;

  if (!empty || $from.parent.type.name !== "paragraph" || editor.isActive("code")) return null;
  const line = currentLine(editor);
  const match = /^\/([a-z]*)$/i.exec(line.text);

  if (!match) return null;

  return { from: line.from, to: $from.pos, query: match[1].toLowerCase(), split: line.split };
}

export function matchingEditorCommands(query: string) {
  return EDITOR_COMMANDS.filter((command) => command.id.startsWith(query));
}

export function runEditorCommand(editor: Editor, match: SlashMatch, command: EditorCommand) {
  let chain = editor.chain().focus().deleteRange({ from: match.from, to: match.to });

  if (match.split) chain = chain.splitBlock();

  switch (command.id) {
    case "code":
      return chain.setCodeBlock().run();
    case "list":
      return chain.toggleBulletList().run();
    case "quote":
      return chain.setBlockquote().run();
    case "heading":
      return chain.setHeading({ level: 2 }).run();
  }
}

/**
 * Block shortcuts (`## `, `- `, `1. `, `> `) apply to a whole block, but Shift+Enter makes several
 * lines inside one paragraph. In such a paragraph, typing a shortcut at the start of any line
 * splits the paragraph around that line and applies the block to it alone. Returns true when it
 * consumed the space. A paragraph without breaks is left to Tiptap's own input rules.
 */
export function handleEditorLineShortcut(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;

  if (!empty || $from.parent.type.name !== "paragraph" || $from.depth !== 1) return false;
  const breaks: number[] = [];

  $from.parent.forEach((child, offset) => {
    if (child.type.name === "hardBreak") breaks.push(offset);
  });
  if (!breaks.length) return false;
  const previous = breaks.filter((offset) => offset < $from.parentOffset).pop();
  const next = breaks.find((offset) => offset >= $from.parentOffset);
  const lineStart = previous === undefined ? 0 : previous + 1;
  const text = $from.parent.textBetween(lineStart, $from.parentOffset, "\n", "\ufffc");
  const heading = /^(#{1,6})$/.exec(text);
  const apply = heading
    ? (chain: ReturnType<Editor["chain"]>) =>
        chain.setHeading({ level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6 })
    : /^[-*+]$/.test(text)
      ? (chain: ReturnType<Editor["chain"]>) => chain.toggleBulletList()
      : /^\d+\.$/.test(text)
        ? (chain: ReturnType<Editor["chain"]>) => chain.toggleOrderedList()
        : text === ">"
          ? (chain: ReturnType<Editor["chain"]>) => chain.setBlockquote()
          : null;

  if (!apply) return false;
  const base = $from.start();
  const tr = state.tr;

  // Edit from the end of the paragraph backwards so earlier positions stay valid.
  if (next !== undefined) tr.delete(base + next, base + next + 1).split(base + next);
  tr.delete(base + lineStart, $from.pos);
  let lineAt = base + lineStart;

  if (previous !== undefined) {
    tr.delete(base + previous, base + previous + 1).split(base + previous);
    lineAt = base + previous + 2;
  }
  tr.setSelection(TextSelection.create(tr.doc, lineAt));
  editor.view.dispatch(tr);

  return apply(editor.chain()).run();
}

/** Fence entry/exit runs before chat's Enter-to-send shortcut. */
export function handleEditorCodeFenceEnter(editor: Editor): boolean {
  const { $from, empty } = editor.state.selection;
  const line = currentLine(editor);
  const fence =
    empty &&
    $from.parent.type.name === "paragraph" &&
    $from.parentOffset === $from.parent.content.size
      ? /^```([\w+-]*)$/.exec(line.text)
      : null;

  if (fence) {
    const chain = editor.chain().deleteRange({ from: line.from, to: $from.pos });

    return (line.split ? chain.splitBlock() : chain)
      .setCodeBlock(fence[1] ? { language: fence[1] } : undefined)
      .run();
  }
  if (
    empty &&
    $from.parent.type.spec.code &&
    $from.parentOffset === $from.parent.content.size &&
    /(?:^|\n)```$/.test($from.parent.textContent)
  ) {
    const count = $from.parent.textContent === "```" ? 3 : 4;

    return editor
      .chain()
      .deleteRange({ from: $from.pos - count, to: $from.pos })
      .exitCode()
      .run();
  }

  return false;
}

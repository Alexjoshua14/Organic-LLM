import { afterEach, describe, expect, test } from "bun:test";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import {
  EDITOR_FIXTURES,
  handleEditorCodeFenceEnter,
  handleEditorLineShortcut,
  findEditorSlash,
  matchingEditorCommands,
  runEditorCommand,
} from "@/components/chat/core-input/editor/editor-model";

import { parseSlashCommand } from "@/lib/chat/slash-command";
import { ComposerCodeBlock } from "@/components/chat/core-input/editor/code-block-editor";
import {
  EditableCodeDelimiters,
  EditorCodeHighlight,
} from "@/components/chat/core-input/editor/code-editing";

const editors: Editor[] = [];

function createEditor(content: string) {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, Markdown, EditableCodeDelimiters],
    content,
    contentType: "markdown",
  });

  editors.push(editor);

  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe("CoreInput editor prototype", () => {
  test("Markdown fixture preserves formatting and code through repeated conversions", () => {
    const editor = createEditor(EDITOR_FIXTURES.markdown);
    const first = editor.getMarkdown();

    editor.commands.setContent(first, { contentType: "markdown" });
    expect(editor.getMarkdown().trimEnd()).toBe(first.trimEnd());
    expect(first).toContain("**two approaches**");
    expect(first).toContain("`useChat`");
    expect(first).toContain("```ts\nconst draft = 'A thought in progress';\n```");
    expect(editor.getJSON().content?.some((node) => node.type === "bulletList")).toBe(true);
    expect(editor.getJSON().content?.some((node) => node.type === "blockquote")).toBe(true);
  });

  test("a slash command replaces its trigger with a real code block", () => {
    const editor = createEditor("/co");

    editor.commands.setTextSelection(4);
    const slash = findEditorSlash(editor);

    expect(slash?.query).toBe("co");
    expect(matchingEditorCommands("co").map((command) => command.id)).toEqual(["code"]);
    runEditorCommand(editor, slash!, matchingEditorCommands("co")[0]);
    expect(editor.getJSON().content?.[0].type).toBe("codeBlock");
    expect(editor.getText().trim()).toBe("");
  });

  test("slashes inside inline code, fenced code, and prose are not commands", () => {
    for (const content of ["`/code`", "```\n/code\n```", "See /code", "https://example.com/code"]) {
      const editor = createEditor(content);

      editor.commands.setTextSelection(Math.max(1, editor.state.doc.content.size - 1));
      expect(findEditorSlash(editor)).toBeNull();
    }
  });

  const BTW = {
    kind: "app",
    id: "btw",
    label: "By the way",
    hint: "Ask aside",
  } as const;

  test("a surface's commands come first, and choosing one writes it for its argument", () => {
    const editor = createEditor("/b");

    editor.commands.setTextSelection(3);
    const slash = findEditorSlash(editor)!;
    const commands = matchingEditorCommands("b", [BTW], slash);

    expect(commands.map((command) => `${command.kind}:${command.id}`)).toEqual(["app:btw"]);
    runEditorCommand(editor, slash, commands[0]);
    editor.commands.insertContent("what does this mean?");
    expect(editor.getMarkdown().trim()).toBe("/btw what does this mean?");
    expect(parseSlashCommand(editor.getMarkdown())).toEqual({
      name: "btw",
      argument: "what does this mean?",
    });
  });

  test("a surface's commands are offered only at the start of the draft", () => {
    const editor = createEditor("First thought\n\n/b");

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const slash = findEditorSlash(editor)!;

    expect(slash.query).toBe("b");
    expect(matchingEditorCommands("b", [BTW], slash)).toEqual([]);
  });

  test("every Markdown command applies its block", () => {
    const expected: Record<string, string> = {
      code: "codeBlock",
      list: "bulletList",
      numbered: "orderedList",
      quote: "blockquote",
      heading: "heading",
      subheading: "heading",
      divider: "horizontalRule",
    };

    for (const command of matchingEditorCommands("")) {
      const editor = createEditor(`/${command.id}`);

      editor.commands.setTextSelection(command.id.length + 2);
      runEditorCommand(editor, findEditorSlash(editor)!, command);
      expect(editor.getJSON().content?.[0].type, command.id).toBe(expected[command.id]);
    }
  });

  test("a selected slash is not an active command", () => {
    const editor = createEditor("/list");

    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(findEditorSlash(editor)).toBeNull();
  });
});

describe("code editing", () => {
  test("active delimiters never enter the document and can remove formatting", () => {
    const editor = createEditor("`keep this`");

    editor.commands.setTextSelection(4);
    const delimiter = editor.view.dom.querySelector<HTMLButtonElement>(".editor-code-delimiter");

    expect(delimiter).not.toBeNull();
    expect(editor.getText()).toBe("keep this");
    expect(editor.getMarkdown().trim()).toBe("`keep this`");
    editor.commands.setTextSelection(10);
    editor.view.someProp("handleKeyDown", (handler) =>
      handler(editor.view, new KeyboardEvent("keydown", { key: "Backspace" }))
    );
    expect(editor.getMarkdown().trim()).toBe("keep this");
    expect(editor.getText()).toBe("keep this");
    expect(editor.view.dom.querySelector(".editor-code-delimiter")).toBeNull();
  });

  test("opening and closing multiline fences enter and exit code without sending", () => {
    const editor = createEditor("");

    editor.commands.insertContent({ type: "text", text: "```ts" });
    expect(handleEditorCodeFenceEnter(editor)).toBe(true);
    expect(editor.isActive("codeBlock")).toBe(true);
    editor.commands.insertContent({ type: "text", text: "const a = 1;\nconst b = 2;\n```" });
    expect(handleEditorCodeFenceEnter(editor)).toBe(true);
    expect(editor.isActive("paragraph")).toBe(true);
    expect(editor.getMarkdown()).toContain("```ts\nconst a = 1;\nconst b = 2;\n```");
  });
});

test("inline code delimiter deletion at either edge preserves the code text", () => {
  for (const position of [1, 5]) {
    for (const key of ["Backspace", "Delete"]) {
      const editor = createEditor("`code`");
      editor.commands.setTextSelection(position);
      editor.view.someProp("handleKeyDown", (handler) =>
        handler(editor.view, new KeyboardEvent("keydown", { key }))
      );
      expect(editor.getText()).toBe("code");
      expect(editor.getMarkdown().trim()).toBe("code");
    }
  }
});

test("unclosed backticks stay literal and receive nonzero-width typography", () => {
  const editor = createEditor("");
  editor.commands.insertContent({ type: "text", text: "`code" });
  expect(editor.getText()).toBe("`code");
  expect(editor.state.selection.from).toBe(6);
  expect(editor.view.dom.querySelector(".editor-literal-backticks")?.textContent).toBe("`");
  expect(editor.view.dom.querySelector("code")).toBeNull();
});

test("the closing delimiter precedes the caret rather than sitting in front of it", () => {
  const editor = createEditor("`code`");
  editor.commands.setTextSelection(5);
  const dom = editor.view.domAtPos(5);
  expect(dom.node.nodeType).toBe(Node.ELEMENT_NODE);
  const beforeCaret = dom.node.childNodes[dom.offset - 1] as HTMLElement;
  expect(beforeCaret.querySelector(".editor-code-delimiter-close")).not.toBeNull();
  expect(editor.getText()).toBe("code");
});

test("code blocks get token decorations without changing the document", () => {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit.configure({ codeBlock: {} }), Markdown, EditorCodeHighlight],
    content: "```ts\nconst answer = 42;\n```",
    contentType: "markdown",
  });

  editors.push(editor);
  const html = editor.view.dom.innerHTML;

  expect(html).toContain("token keyword");
  expect(html).toContain("token number");
  expect(editor.getMarkdown().trimEnd()).toBe("```ts\nconst answer = 42;\n```");
});

test("new code blocks default to Python unless a language is given", () => {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit.configure({ codeBlock: false }), ComposerCodeBlock, Markdown],
    content: "",
  });

  editors.push(editor);
  editor.commands.setCodeBlock();
  expect(editor.getJSON().content?.[0]?.attrs?.language).toBe("python");
  editor.commands.setCodeBlock({ language: "ts" });
  expect(editor.getJSON().content?.[0]?.attrs?.language).toBe("ts");
});

test("a fence or slash command after a Shift+Enter break starts a block on that line", () => {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit.configure({ codeBlock: false }), ComposerCodeBlock, Markdown],
    content: "<p>hello<br>```py</p>",
  });

  editors.push(editor);
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  expect(handleEditorCodeFenceEnter(editor)).toBe(true);
  expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
    "paragraph",
    "codeBlock",
    "paragraph",
  ]);
  expect(editor.getJSON().content?.[0]?.content?.map((node) => node.type)).toEqual(["text"]);
  expect(editor.getJSON().content?.[1]?.attrs?.language).toBe("py");

  editor.commands.setContent("<p>hello<br>/co</p>");
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  const slash = findEditorSlash(editor);

  expect(slash?.query).toBe("co");
  runEditorCommand(editor, slash!, matchingEditorCommands("co")[0]);
  expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
    "paragraph",
    "codeBlock",
    "paragraph",
  ]);
});

test("heading, list and quote shortcuts work on a line after a Shift+Enter break", () => {
  const cases: [string, string][] = [
    ["##", "heading"],
    ["-", "bulletList"],
    ["1.", "orderedList"],
    [">", "blockquote"],
  ];

  for (const [marker, type] of cases) {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, Markdown],
      content: `<p>hello<br>${marker}</p>`,
    });

    editors.push(editor);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(handleEditorLineShortcut(editor)).toBe(true);
    const types = editor.getJSON().content?.map((node) => node.type);

    expect(types?.[0]).toBe("paragraph");
    expect(types?.[1]).toBe(type);
    expect(editor.getText()).not.toContain(marker);
  }
});

test("a line shortcut needs a break; the first line is left to Tiptap's own rules", () => {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, Markdown],
    content: "<p>##</p>",
  });

  editors.push(editor);
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  expect(handleEditorLineShortcut(editor)).toBe(false);
});

test("a shortcut on an earlier line converts only that line", () => {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, Markdown],
    content: "<p>a<br>##b<br>c</p>",
  });

  editors.push(editor);
  editor.commands.setTextSelection(5);
  expect(handleEditorLineShortcut(editor)).toBe(true);
  const blocks = editor.getJSON().content ?? [];

  expect(blocks.map((node) => node.type)).toEqual(["paragraph", "heading", "paragraph"]);
  expect(blocks[1]?.attrs?.level).toBe(2);
  expect(editor.getText({ blockSeparator: "|" })).toBe("a|b|c");

  editor.commands.setContent("<p>##first<br>second</p>");
  editor.commands.setTextSelection(3);
  expect(handleEditorLineShortcut(editor)).toBe(true);
  expect(editor.getJSON().content?.map((node) => node.type)).toEqual(["heading", "paragraph"]);
  expect(editor.getText({ blockSeparator: "|" })).toBe("first|second");
});

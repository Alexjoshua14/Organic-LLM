"use client";

import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import type { SlashMatch } from "@/components/chat/core-input/editor/editor-model";

import { createPortal } from "react-dom";
import { memo, useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";

import {
  findEditorSlash,
  matchingEditorCommands,
  runEditorCommand,
  handleEditorCodeFenceEnter,
  handleEditorLineShortcut,
} from "@/components/chat/core-input/editor/editor-model";
import {
  EditableCodeDelimiters,
  EditorCodeHighlight,
} from "@/components/chat/core-input/editor/code-editing";
import { ComposerCodeBlock } from "@/components/chat/core-input/editor/code-block-editor";
import { LumenSubmit } from "@/components/chat/core-input/editor/lumen-submit";
import { useComposerReflow } from "@/components/chat/core-input/editor/use-composer-reflow";

import { useSubmitOnEnter } from "@/hooks/use-mobile";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

const extensions = [
  StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
  ComposerCodeBlock,
  EditableCodeDelimiters,
  EditorCodeHighlight,
  Markdown,
  Placeholder.configure({ placeholder: "Drop a thought" }),
];

type Props = {
  initialMarkdown: string;
  /** Composer settings; leads the line and stays on the left when the composer stacks. */
  leading?: ReactNode;
  /** Attachments and mic; sit beside Send on one line, and move left under the text when stacked. */
  trailing?: ReactNode;
  toolsOpen?: boolean;
  toolsContainer?: HTMLElement | null;
  busy: boolean;
  voice: boolean;
  onSend: (markdown: string) => void;
  onStop: () => void;
};

/** The editor owns its document; shell changes never feed a new value back on each keystroke. */
export const RichComposer = memo(function RichComposer({
  initialMarkdown,
  leading,
  trailing,
  toolsOpen = false,
  toolsContainer,
  busy,
  voice,
  onSend,
  onStop,
}: Props) {
  const menuId = useId();
  const [mode, setMode] = useState<"formatted" | "source">("formatted");
  const [source, setSource] = useState(initialMarkdown);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [slash, setSlash] = useState<SlashMatch | null>(null);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState("");
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const richChanged = useRef(false);
  const canSubmit = useSubmitOnEnter();
  const rowRef = useRef<HTMLDivElement>(null);
  const handlers = useRef({ busy, voice, canSubmit, onSend, slash, active, source, mode });

  handlers.current = { busy, voice, canSubmit, onSend, slash, active, source, mode };

  const refreshSlash = (editor: Editor) => {
    const next = findEditorSlash(editor);

    setSlash((previous) =>
      previous?.from === next?.from && previous?.to === next?.to && previous?.query === next?.query
        ? previous
        : next
    );
    setActive(0);
  };

  const editor = useEditor({
    extensions,
    content: initialMarkdown,
    contentType: "markdown",
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      richChanged.current = true;
      refreshSlash(editor);
    },
    onSelectionUpdate: ({ editor }) => refreshSlash(editor),
    editorProps: {
      attributes: {
        class: "editor-surface organic-code editor-text-focus rounded-xl",
        role: "textbox",
        "aria-label": "Prototype message",
        "aria-multiline": "true",
        spellcheck: "true",
      },
      handleKeyDown: (view, event) => {
        if (event.isComposing || view.composing) return false;
        const current = handlers.current;
        const commands = current.slash ? matchingEditorCommands(current.slash.query) : [];

        if (current.slash) {
          if (event.key === "Escape") {
            setSlash(null);

            return true;
          }
          if (commands.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            setActive(
              (index) =>
                (index + (event.key === "ArrowDown" ? 1 : -1) + commands.length) % commands.length
            );

            return true;
          }
          if (event.key === "Enter") {
            if (commands.length && editor)
              runEditorCommand(editor, current.slash, commands[current.active % commands.length]);

            return true;
          }
        }
        // HardBreak's default Shift+Enter first tries exitCode; keep it inside code instead.
        if (
          event.key === "Enter" &&
          event.shiftKey &&
          view.state.selection.$from.parent.type.spec.code
        ) {
          if (!current.busy && !current.voice && editor) editor.commands.newlineInCode();

          return true;
        }
        // A heading is a single line: Shift+Enter leaves it for a plain paragraph.
        if (
          event.key === "Enter" &&
          event.shiftKey &&
          view.state.selection.$from.parent.type.name === "heading"
        ) {
          if (!current.busy && !current.voice && editor)
            editor.chain().splitBlock().setParagraph().run();

          return true;
        }
        if (event.key === " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
          if (!current.busy && !current.voice && editor && handleEditorLineShortcut(editor))
            return true;
        }
        if (event.key === "Enter" && !event.shiftKey && !current.busy && !current.voice && editor) {
          if (handleEditorCodeFenceEnter(editor)) return true;
        }
        // Code blocks and touch-primary keyboards keep Enter for editing.
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.altKey &&
          (current.canSubmit || event.metaKey || event.ctrlKey) &&
          !view.state.selection.$from.parent.type.spec.code
        ) {
          if (!current.busy && !current.voice && editor && !editor.isEmpty) {
            current.onSend(richChanged.current ? editor.getMarkdown() : current.source);
          }

          return true;
        }

        return false;
      },
    },
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor }) => ({
      empty: editor?.isEmpty ?? true,
      bold: editor?.isActive("bold") ?? false,
      code: editor?.isActive("code") ?? false,
      codeBlock: editor?.isActive("codeBlock") ?? false,
    }),
  });

  // The same one-line → stacked logic CoreInput uses (editor/use-composer-reflow.ts).
  const expanded = useComposerReflow(rowRef, editor, {
    enabled: true,
    forced: mode === "source" || voice,
  });
  useEffect(() => {
    editor?.setEditable(!busy && !voice);
  }, [editor, busy, voice]);
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    if (slash && matchingEditorCommands(slash.query).length) {
      dom.setAttribute("aria-controls", menuId);
      dom.setAttribute("aria-activedescendant", `${menuId}-${active}`);
    } else {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    }
  }, [editor, slash, active, menuId]);

  const switchMode = () => {
    if (!editor) return;
    setSlash(null);
    if (mode === "formatted") {
      const next = richChanged.current ? editor.getMarkdown() : source;

      setSource(next);
      richChanged.current = false;
      setMode("source");
      requestAnimationFrame(() => sourceRef.current?.focus());
    } else {
      setSnapshot(source);
      editor.commands.setContent(source, { contentType: "markdown", emitUpdate: false });
      richChanged.current = false;
      setMode("formatted");
      setNotice(
        "Source snapshot saved. Formatting supports emphasis, links, lists, quotes, headings, and code. Other syntax may change; restore the snapshot if needed."
      );
      editor.commands.focus();
    }
  };

  const send = () => {
    if (!editor || busy || voice) return;
    onSend(mode === "source" || !richChanged.current ? source : editor.getMarkdown());
  };
  const commands = slash ? matchingEditorCommands(slash.query) : [];
  const empty = mode === "source" ? !source.trim() : editorState?.empty;

  const tools = (
    <div className="flex flex-wrap items-center gap-inline-sm border-b border-border/40 p-inset-sm">
      <div aria-label="Text formatting" className="flex gap-inline-sm">
        <Button
          aria-label="Bold"
          aria-pressed={editorState?.bold ?? false}
          className="min-h-11 min-w-11 font-bold"
          disabled={mode === "source" || busy || voice}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          B
        </Button>
        <Button
          aria-label="Inline code"
          aria-pressed={editorState?.code ?? false}
          className="min-h-11 min-w-11 font-mono"
          disabled={mode === "source" || busy || voice}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          &lt;/&gt;
        </Button>
      </div>
      <Button
        aria-label={mode === "formatted" ? "Edit Markdown source" : "Return to formatted editing"}
        className="min-h-11"
        disabled={busy || voice || !editor}
        size="sm"
        type="button"
        variant="ghost"
        onClick={switchMode}
      >
        {mode === "formatted" ? "Markdown source" : "Formatted view"}
      </Button>
      <Button
        aria-label="Insert multiline code block"
        className="min-h-11"
        disabled={mode === "source" || busy || voice}
        size="sm"
        type="button"
        variant="ghost"
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        Code block
      </Button>
      {editorState?.code || editorState?.codeBlock ? (
        <Button
          className="min-h-11"
          disabled={busy || voice}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => editor?.chain().focus().unsetCode().setParagraph().run()}
        >
          Plain text
        </Button>
      ) : null}
    </div>
  );

  return (
    <form
      aria-label="Prototype composer"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {toolsOpen ? (toolsContainer ? createPortal(tools, toolsContainer) : tools) : null}
      {slash && !voice && mode === "formatted" ? (
        <div
          aria-label="Slash commands"
          className="mx-inset-sm mb-stack-sm rounded-xl border border-border bg-background p-inset-sm shadow-sm"
          id={menuId}
          role="listbox"
        >
          {commands.length ? (
            commands.map((command, index) => (
              <button
                key={command.id}
                aria-selected={active === index}
                className={cn(
                  "organic-focus flex min-h-11 w-full items-center justify-between gap-inline-sm rounded-lg px-inset-sm text-left text-sm",
                  active === index && "bg-muted"
                )}
                id={`${menuId}-${index}`}
                role="option"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (editor) runEditorCommand(editor, slash, command);
                  setSlash(null);
                }}
              >
                <span>{command.label}</span>
                <span className="text-xs text-muted-foreground">/{command.id}</span>
              </button>
            ))
          ) : (
            <p className="p-inset-sm text-sm text-muted-foreground">
              No matching command. Escape closes this menu.
            </p>
          )}
        </div>
      ) : null}
      {notice ? (
        <div className="px-inset-md pb-inset-sm text-xs text-muted-foreground" role="status">
          {notice}
          {snapshot !== null ? (
            <Button
              className="ml-1 min-h-11"
              disabled={busy || voice}
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setSource(snapshot);
                richChanged.current = false;
                setMode("source");
                setNotice("");
                requestAnimationFrame(() => sourceRef.current?.focus());
              }}
            >
              Restore source snapshot
            </Button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={rowRef}
        className="editor-row editor-footer"
        data-expanded={expanded ? "true" : "false"}
      >
        <div className="editor-lead min-h-11" data-reflow="lead">
          {leading}
        </div>
        <div className={cn("editor-area", !expanded && "min-h-11")} data-reflow="area">
          <div className={cn((voice || mode === "source") && "hidden")}>
            <EditorContent editor={editor} />
          </div>
          <textarea
            ref={sourceRef}
            aria-label="Markdown source"
            className={cn(
              "editor-surface editor-text-focus block w-full resize-y rounded-xl bg-transparent font-mono",
              (voice || mode !== "source") && "hidden"
            )}
            disabled={busy || voice}
            rows={6}
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          {voice ? (
            <div
              className="editor-feedback flex min-h-24 items-center gap-inline-md p-inset-md"
              role="status"
            >
              <span className="editor-voice-dot size-3 rounded-full bg-foreground" />
              <div>
                <p className="text-sm">Listening · simulated</p>
                <p className="text-xs text-muted-foreground">
                  Your draft is held here. No microphone is connected.
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="editor-trail min-h-11" data-reflow="trail">
          {trailing}
        </div>
        <div className="editor-send min-h-11" data-reflow="send">
          <LumenSubmit
            aria-label={busy ? "Stop simulated response" : "Send prototype message"}
            className="size-9 rounded-full"
            disabled={!busy && (empty || voice || !editor)}
            status={busy ? "streaming" : "ready"}
            stop={onStop}
          />
        </div>
      </div>
    </form>
  );
});

"use client";

import type { Editor } from "@tiptap/core";
import type {
  ChangeEvent,
  ChangeEventHandler,
  ClipboardEventHandler,
  ReactNode,
  RefObject,
} from "react";
import type { SlashMatch } from "./editor-model";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";

import { ComposerCodeBlock } from "./code-block-editor";
import { EditableCodeDelimiters, EditorCodeHighlight } from "./code-editing";
import {
  findEditorSlash,
  handleEditorCodeFenceEnter,
  handleEditorLineShortcut,
  matchingEditorCommands,
  runEditorCommand,
} from "./editor-model";
import "./composer-editor.css";

import { useSubmitOnEnter } from "@/hooks/use-mobile";
import {
  usePromptInputAttachments,
  usePromptInputController,
} from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

export const COMPOSER_DEFAULT_PLACEHOLDER = "Drop a thought";

type ComposerEditorProps = {
  /**
   * CoreInput's textarea ref. It now points at a hidden textarea that mirrors the editor's
   * Markdown, so form submission (`name="message"`), drafts, dictation and focus keep working
   * through the same ref and value they always used.
   */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** The draft as Markdown. Changes from outside (send, restore, dictation) replace the content. */
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  "aria-label"?: string;
  className?: string;
  /** Runs before the editor sees a paste; call `preventDefault` to take it over. */
  onPasteCapture?: ClipboardEventHandler<HTMLDivElement>;
  /** Cmd/Ctrl+Enter (steer); without it the shortcut does nothing. */
  onModEnter?: () => void;
  onSelect?: () => void;
  /** The live editor, for layout measurement. */
  onEditor?: (editor: Editor | null) => void;
  children?: ReactNode;
};

/** CoreInput's editing surface: formatted Markdown as you type, over a textarea-shaped contract. */
export function ComposerEditor({
  textareaRef,
  value,
  onChange,
  placeholder = COMPOSER_DEFAULT_PLACEHOLDER,
  disabled = false,
  maxLength,
  "aria-label": ariaLabel,
  className,
  onPasteCapture,
  onModEnter,
  onSelect,
  onEditor,
}: ComposerEditorProps) {
  const menuId = useId();
  const controller = useOptionalController();
  const attachments = usePromptInputAttachments();
  const canSubmit = useSubmitOnEnter();
  const [slash, setSlash] = useState<SlashMatch | null>(null);
  const [active, setActive] = useState(0);
  const emitted = useRef(value);
  const pointerFocus = useRef(false);
  const latest = useRef({ onChange, onModEnter, onSelect, canSubmit, disabled, slash, active });

  latest.current = { onChange, onModEnter, onSelect, canSubmit, disabled, slash, active };

  /** Mirror Markdown into the hidden textarea and report it the way a textarea change would. */
  const emit = useCallback(
    (markdown: string) => {
      emitted.current = markdown;
      const textarea = textareaRef.current;

      if (!textarea) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

      setter?.call(textarea, markdown);
      controller?.textInput.setInput(markdown);
      latest.current.onChange({
        target: textarea,
        currentTarget: textarea,
      } as ChangeEvent<HTMLTextAreaElement>);
    },
    [controller, textareaRef]
  );

  const refreshSlash = (target: Editor) => {
    const next = findEditorSlash(target);

    setSlash((previous) =>
      previous?.from === next?.from && previous?.to === next?.to && previous?.query === next?.query
        ? previous
        : next
    );
    setActive(0);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
      ComposerCodeBlock,
      EditableCodeDelimiters,
      EditorCodeHighlight,
      Markdown,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: !disabled,
    onUpdate: ({ editor: target }) => {
      const markdown = target.isEmpty ? "" : target.getMarkdown();

      emit(maxLength ? markdown.slice(0, maxLength) : markdown);
      refreshSlash(target);
    },
    onSelectionUpdate: ({ editor: target }) => {
      refreshSlash(target);
      latest.current.onSelect?.();
    },
    editorProps: {
      attributes: {
        class: "editor-surface organic-code editor-text-focus",
        role: "textbox",
        "aria-label": ariaLabel ?? placeholder,
        "aria-multiline": "true",
        spellcheck: "true",
        enterkeyhint: canSubmit ? "send" : "enter",
      },
      handleKeyDown: (view, event) => {
        if (event.isComposing || view.composing) return false;
        const current = latest.current;
        const target = editorRef.current;

        if (!target || current.disabled) return false;
        const commands = current.slash ? matchingEditorCommands(current.slash.query) : [];
        const inCode = Boolean(view.state.selection.$from.parent.type.spec.code);

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
          if (event.key === "Enter" && commands.length) {
            runEditorCommand(target, current.slash, commands[current.active % commands.length]);
            setSlash(null);

            return true;
          }
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          if (!current.onModEnter) return false;
          event.preventDefault();
          current.onModEnter();

          return true;
        }
        // Shift+Enter stays inside code, and leaves a heading for a plain paragraph.
        if (event.key === "Enter" && event.shiftKey && inCode) {
          target.commands.newlineInCode();

          return true;
        }
        if (
          event.key === "Enter" &&
          event.shiftKey &&
          view.state.selection.$from.parent.type.name === "heading"
        ) {
          target.chain().splitBlock().setParagraph().run();

          return true;
        }
        if (event.key === " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
          if (handleEditorLineShortcut(target)) return true;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          if (handleEditorCodeFenceEnter(target)) return true;
        }
        // Enter sends on keyboards; touch keyboards and code blocks keep Enter for editing.
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.altKey &&
          current.canSubmit &&
          !inCode
        ) {
          event.preventDefault();
          const form = view.dom.closest("form");
          const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');

          if (submit && !submit.disabled) form?.requestSubmit();

          return true;
        }
        if (event.key === "Backspace" && target.isEmpty && attachments.files.length > 0) {
          const last = attachments.files.at(-1);

          if (last) attachments.remove(last.id);

          return true;
        }

        return false;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.items ?? [])
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file));

        if (!files.length) return false;
        attachments.add(files);

        return true;
      },
    },
  });

  const editorRef = useRef<Editor | null>(null);

  editorRef.current = editor;

  useEffect(() => {
    onEditor?.(editor);

    return () => onEditor?.(null);
  }, [editor, onEditor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // A value set from outside (cleared after send, a restored draft, dictation) replaces the
  // content. The editor's own edits come back as the value it just emitted and are ignored.
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

  const commands = slash ? matchingEditorCommands(slash.query) : [];

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;

    if (slash && commands.length) {
      dom.setAttribute("aria-controls", menuId);
      dom.setAttribute("aria-activedescendant", `${menuId}-${active}`);
    } else {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    }
  }, [editor, slash, active, menuId, commands.length]);

  return (
    <div
      className={cn("organic-composer composer-editor relative w-full min-w-0", className)}
      onPasteCapture={onPasteCapture}
    >
      {slash && commands.length ? (
        <div
          aria-label="Slash commands"
          className="absolute bottom-full left-0 z-20 mb-stack-sm w-full max-w-xs rounded-xl border border-border bg-background p-inset-sm shadow-sm"
          id={menuId}
          role="listbox"
        >
          {commands.map((command, index) => (
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
              onClick={() => {
                if (editor) runEditorCommand(editor, slash, command);
                setSlash(null);
              }}
              onMouseDown={(event) => event.preventDefault()}
            >
              <span>{command.label}</span>
              <span className="text-xs text-muted-foreground">/{command.id}</span>
            </button>
          ))}
        </div>
      ) : null}
      <EditorContent editor={editor} />
      {/* The form field and the ref CoreInput already uses. Focusing it hands focus to the editor. */}
      <textarea
        ref={textareaRef}
        aria-hidden
        className="sr-only"
        disabled={disabled}
        maxLength={maxLength}
        name="message"
        tabIndex={-1}
        value={value}
        onChange={onChange}
        onFocus={() => {
          // Code that focuses the field (restoring a draft) means "focus the composer". Only a
          // pointer can land on the clipped field itself (tests type into it), so leave that be.
          if (pointerFocus.current) pointerFocus.current = false;
          else editor?.commands.focus("end");
        }}
        onPointerDown={() => {
          pointerFocus.current = true;
        }}
        onKeyDown={(event) => {
          // The field follows the editor's Enter rule, so the two can never disagree.
          if (
            event.key !== "Enter" ||
            event.shiftKey ||
            event.altKey ||
            event.nativeEvent.isComposing ||
            !canSubmit
          )
            return;
          if (event.metaKey || event.ctrlKey) {
            if (onModEnter) {
              event.preventDefault();
              onModEnter();
            }

            return;
          }
          event.preventDefault();
          const submit =
            event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');

          if (submit && !submit.disabled) event.currentTarget.form?.requestSubmit();
        }}
      />
    </div>
  );
}

/** The PromptInput controller when CoreInput sits inside a provider (e.g. Rabbit Holes). */
function useOptionalController() {
  try {
    return usePromptInputController();
  } catch {
    return null;
  }
}

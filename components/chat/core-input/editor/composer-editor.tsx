"use client";

import type { Editor } from "@tiptap/core";
import type {
  ChangeEvent,
  ChangeEventHandler,
  ClipboardEventHandler,
  ReactNode,
  RefObject,
} from "react";
import type { AppCommand, EditorCommand, SlashMatch } from "./editor-model";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Selection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { CharacterCount, Placeholder } from "@tiptap/extensions";

import { PANEL_COLLISION_PADDING_PX, PANEL_OVERLAP_PX, panelAlign } from "../panel-placement";

import { ComposerCodeBlock } from "./code-block-editor";
import { EditableCodeDelimiters, EditorCodeHighlight } from "./code-editing";
import { useContainedScroll } from "./contained-scroll";
import { SLASH_HIGHLIGHT_REFRESH, SlashHighlight } from "./slash-highlight";
import { PLACEHOLDER_CHANGED } from "./use-composer-reflow";
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
import { homeComposerGlassSurface } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export const COMPOSER_DEFAULT_PLACEHOLDER = "Drop a thought";

const NO_COMMANDS: readonly AppCommand[] = [];
const COMMAND_GROUPS = [
  { kind: "app", label: "Commands" },
  { kind: "markdown", label: "Markdown" },
] as const;

/** Anything that handles its own tap; a tap anywhere else in the composer goes to the draft. */
const OWNS_TAP =
  'button, a[href], input, select, textarea, label, summary, [contenteditable="true"], [role="button"], [role="switch"], [role="option"], [role^="menuitem"], [role="slider"], [role="tab"], [data-composer-own-tap]';

/**
 * A tap on the composer's empty space (padding, gaps, the line around the text) focuses the
 * draft, so the whole shell is a target, not just the text. Taps on controls are left alone, and
 * so is a drag that selected text.
 */
export function focusDraftFromShell(target: EventTarget | null, editor: Editor | null) {
  if (!editor || editor.isDestroyed || !editor.isEditable) return;
  if (!(target instanceof Element) || target.closest(OWNS_TAP)) return;
  if (window.getSelection()?.toString()) return;
  editor.commands.focus("end");
}

function SlashOption({
  command,
  active,
  id,
  onChoose,
}: {
  command: EditorCommand;
  active: boolean;
  id: string;
  onChoose: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "organic-focus flex min-h-11 w-full items-center justify-between gap-inline-sm rounded-lg px-inset-sm text-left text-sm",
        active && "bg-muted"
      )}
      id={id}
      role="option"
      title={command.hint}
      type="button"
      onClick={onChoose}
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="flex min-w-0 flex-col">
        <span>{command.label}</span>
        {command.kind === "app" ? (
          <span className="truncate text-xs text-muted-foreground">{command.hint}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 text-xs",
          // A command the surface runs carries the warm accent it wears in the draft.
          command.kind === "app" ? "text-accent-warm" : "text-muted-foreground"
        )}
      >
        /{command.id}
      </span>
    </button>
  );
}

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
  /** Commands the surface runs on send (`/btw`), offered in the slash menu above Markdown. */
  commands?: readonly AppCommand[];
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
  commands: appCommands = NO_COMMANDS,
}: ComposerEditorProps) {
  const menuId = useId();
  const [menu, setMenu] = useState<HTMLDivElement | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // The menu's anchor (the prompt shell, else the editor itself) and portal (CoreInput's panel slot).
  const shell = root?.closest<HTMLElement>("[data-prompt-input-shell]") ?? root;
  const menuSlot =
    root
      ?.closest<HTMLElement>("[data-core-input-root]")
      ?.querySelector<HTMLElement>("[data-core-input-panel-slot]") ?? undefined;
  const menuAnchor = useMemo(() => ({ current: shell }), [shell]);

  useContainedScroll(menu);

  // Scrolling the draft or the slash menu never carries on into the page behind.
  useContainedScroll(root);
  const controller = useOptionalController();
  const attachments = usePromptInputAttachments();
  const canSubmit = useSubmitOnEnter();
  const [slash, setSlash] = useState<SlashMatch | null>(null);
  const [active, setActive] = useState(0);
  const emitted = useRef(value);
  const pointerFocus = useRef(false);
  const latest = useRef({
    onChange,
    onModEnter,
    onSelect,
    canSubmit,
    disabled,
    slash,
    active,
    appCommands,
    placeholder,
  });

  latest.current = {
    onChange,
    onModEnter,
    onSelect,
    canSubmit,
    disabled,
    slash,
    active,
    appCommands,
    placeholder,
  };

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
      SlashHighlight.configure({
        appCommandIds: () => latest.current.appCommands.map((command) => command.id),
        complete: (typed) => {
          const options = matchingEditorCommands(typed.query, latest.current.appCommands, typed);

          return options.length ? options[latest.current.active % options.length].id : null;
        },
      }),
      // Read live: the placeholder changes with context (a `/btw` side question).
      Placeholder.configure({ placeholder: () => latest.current.placeholder }),
      // The limit stops typing at the edge, so the draft on screen is the draft that sends.
      ...(maxLength ? [CharacterCount.configure({ limit: maxLength })] : []),
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
        const commands = current.slash
          ? matchingEditorCommands(current.slash.query, current.appCommands, current.slash)
          : [];
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
          if ((event.key === "Enter" || event.key === "Tab") && commands.length) {
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

  // The editor's attributes are set when it is created; keep the ones that follow props current.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;

    dom.setAttribute("aria-label", ariaLabel ?? placeholder);
    dom.setAttribute("enterkeyhint", canSubmit ? "send" : "enter");
    // Redraw the placeholder decoration with the new text.
    editor.view.dispatch(
      editor.state.tr.setMeta("addToHistory", false).setMeta(PLACEHOLDER_CHANGED, true)
    );
  }, [editor, ariaLabel, placeholder, canSubmit]);

  // Leaving the app (switching apps on a phone) blurs the editor, but the OS can keep the keyboard
  // up on return, typing into nothing. If the draft had focus when the page went away, give it
  // focus back, at the same caret, when the page returns.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let resume = false;
    const hadFocus = () =>
      editor.isFocused || editor.view.dom.contains(document.activeElement as Node | null);
    const onLeave = () => {
      if (document.visibilityState === "hidden" || !document.hasFocus()) resume ||= hadFocus();
    };
    const onReturn = () => {
      if (!resume || document.visibilityState !== "visible") return;
      resume = false;
      requestAnimationFrame(() => {
        if (editor.isDestroyed || !editor.isEditable || hadFocus()) return;
        // Only if nothing else took focus meanwhile.
        const current = document.activeElement;

        if (current && current !== document.body) return;
        editor.commands.focus();
      });
    };
    const onPointerDown = () => {
      resume = false;
    };
    // Some phones blur the draft before the page reports hiding; a blur while the page has no
    // focus is the page going away, not the person leaving the draft.
    const onEditorBlur = () => {
      if (document.visibilityState === "hidden" || !document.hasFocus()) resume = true;
    };

    editor.on("blur", onEditorBlur);

    document.addEventListener("visibilitychange", onLeave);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("blur", onLeave);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      document.removeEventListener("visibilitychange", onLeave);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("pointerdown", onPointerDown, true);
      editor.off("blur", onEditorBlur);
    };
  }, [editor]);

  // A value set from outside (cleared after send, a restored draft, dictation) replaces the
  // content. The editor's own edits come back as the value it just emitted and are ignored.
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === emitted.current) return;
    emitted.current = value;
    editor
      .chain()
      .setContent(value, { contentType: "markdown", emitUpdate: false })
      // Continue after the new text (dictation streaming in, a restored draft), not before it.
      .command(({ tr }) => {
        tr.setSelection(Selection.atEnd(tr.doc));

        return true;
      })
      .run();
  }, [editor, value]);

  const commands = slash ? matchingEditorCommands(slash.query, appCommands, slash) : [];
  const menuOpen = Boolean(slash && commands.length);

  // The ghost completion follows the menu's active command; redraw it when that changes.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(
      editor.state.tr.setMeta("addToHistory", false).setMeta(SLASH_HIGHLIGHT_REFRESH, true)
    );
  }, [editor, active, appCommands]);

  // Arrow keys move through the menu; keep the active option in view inside it.
  useEffect(() => {
    // Options render in the same order as `active` counts them.
    const option = menu?.querySelectorAll<HTMLElement>('[role="option"]')[active];

    if (!menu || !option) return;
    // Scroll the menu alone (scrollIntoView would also move the page).
    const top = option.getBoundingClientRect().top - menu.getBoundingClientRect().top;
    const bottom = top + option.offsetHeight;

    if (top < 0) menu.scrollTop += top;
    else if (bottom > menu.clientHeight) menu.scrollTop += bottom - menu.clientHeight;
  }, [menu, active]);

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
      ref={setRoot}
      className={cn("organic-composer composer-editor relative w-full min-w-0", className)}
      onPasteCapture={onPasteCapture}
    >
      {/* The menu opens over the whole composer, like its settings panel (anchored to the shell,
          portaled into the CoreInput panel slot), not inside the draft's own narrow column. Focus
          and keys stay in the editor. */}
      <Popover.Root
        open={menuOpen}
        onOpenChange={(next) => {
          if (!next) setSlash(null);
        }}
      >
        <Popover.Anchor virtualRef={menuAnchor} />
        <Popover.Portal container={menuSlot}>
          <Popover.Content
            ref={setMenu}
            align={menuOpen ? panelAlign() : "start"}
            aria-label="Slash commands"
            className={cn(homeComposerGlassSurface, "core-input-slash-menu")}
            // Always above the draft, never flipped over it: it scrolls in the room it has.
            avoidCollisions={false}
            collisionPadding={PANEL_COLLISION_PADDING_PX}
            id={menuId}
            role="listbox"
            side="top"
            sideOffset={-PANEL_OVERLAP_PX}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            {COMMAND_GROUPS.filter((group) =>
              commands.some((command) => command.kind === group.kind)
            ).map((group, groupIndex) => {
              const items = commands.filter((command) => command.kind === group.kind);
              const labelId = `${menuId}-${group.kind}`;

              return (
                <div
                  key={group.kind}
                  aria-labelledby={labelId}
                  className={cn(
                    // A hairline and a step of space between the surface's commands and Markdown.
                    groupIndex > 0 && "mt-stack-xs border-t border-border/60 pt-stack-xs"
                  )}
                  role="group"
                >
                  <div
                    className="px-inset-sm pt-stack-xs pb-stack-xs text-2xs font-medium uppercase tracking-widest text-muted-foreground"
                    id={labelId}
                    role="presentation"
                  >
                    {group.label}
                  </div>
                  {items.map((command) => {
                    const index = commands.indexOf(command);

                    return (
                      <SlashOption
                        key={`${command.kind}-${command.id}`}
                        active={active === index}
                        command={command}
                        id={`${menuId}-${index}`}
                        onChoose={() => {
                          if (editor && slash) runEditorCommand(editor, slash, command);
                          setSlash(null);
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
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
